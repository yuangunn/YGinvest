"""Oracle Cloud ARM Always Free 자동 시도 스크립트.

GitHub Actions 또는 로컬에서 cron으로 주기 실행.
- 이미 ARM 인스턴스가 있으면 종료 (성공)
- 없으면 launch 시도
- "Out of capacity"면 silent exit (다음 cron 대기)
- 성공 시 Telegram/Discord 알림 (선택)

환경변수로 모든 설정 주입 — GitHub Secrets 활용.
"""

import json
import os
import sys
from base64 import b64encode
from typing import Optional

import oci
import urllib.request


def env(key: str, default: Optional[str] = None, required: bool = True) -> str:
    v = os.environ.get(key, default)
    if required and not v:
        print(f"[FATAL] Missing env var: {key}")
        sys.exit(2)
    return v or ""


def build_config() -> dict:
    """OCI SDK config dict — 환경변수에서 구성."""
    return {
        "user": env("OCI_USER_OCID"),
        "tenancy": env("OCI_TENANCY_OCID"),
        "region": env("OCI_REGION", "ap-seoul-1"),
        "fingerprint": env("OCI_FINGERPRINT"),
        "key_content": env("OCI_PRIVATE_KEY"),
    }


def notify(message: str) -> None:
    """선택적 알림 — Telegram bot 또는 Discord webhook."""
    tg_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    tg_chat = os.environ.get("TELEGRAM_CHAT_ID")
    discord_webhook = os.environ.get("DISCORD_WEBHOOK_URL")

    if tg_token and tg_chat:
        try:
            url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
            data = json.dumps({"chat_id": tg_chat, "text": message}).encode()
            req = urllib.request.Request(
                url, data=data, headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(req, timeout=10).read()
            print("[notify] sent to Telegram")
        except Exception as e:
            print(f"[notify] Telegram failed: {e}")

    if discord_webhook:
        try:
            data = json.dumps({"content": message}).encode()
            req = urllib.request.Request(
                discord_webhook,
                data=data,
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=10).read()
            print("[notify] sent to Discord")
        except Exception as e:
            print(f"[notify] Discord failed: {e}")


def already_has_arm(compute, compartment_id: str) -> bool:
    """ARM A1.Flex 인스턴스가 이미 있으면 True."""
    instances = oci.pagination.list_call_get_all_results(
        compute.list_instances,
        compartment_id=compartment_id,
    ).data
    for inst in instances:
        if inst.lifecycle_state in ("TERMINATED", "TERMINATING"):
            continue
        if "A1.Flex" in (inst.shape or ""):
            print(
                f"[exists] ARM instance found: {inst.display_name} ({inst.lifecycle_state})"
            )
            return True
    return False


def try_launch_arm(compute, identity, config: dict) -> bool:
    """ARM 인스턴스 launch 시도. 성공 True / 실패 False."""
    compartment = env("OCI_COMPARTMENT_ID")
    subnet = env("OCI_SUBNET_ID")
    image = env("OCI_IMAGE_OCID")  # Ubuntu 22.04 ARM
    ssh_pub = env("OCI_SSH_PUBLIC_KEY")
    display = env("OCI_INSTANCE_NAME", "yginvest-arm", required=False)
    ocpus = int(env("OCI_ARM_OCPUS", "2", required=False))
    mem_gb = float(env("OCI_ARM_MEMORY_GB", "12", required=False))
    boot_gb = int(env("OCI_ARM_BOOT_GB", "50", required=False))

    # 가용성 도메인 조회
    ads = identity.list_availability_domains(compartment_id=compartment).data
    if not ads:
        print("[FATAL] No availability domains found")
        return False

    for ad in ads:
        ad_name = ad.name
        print(f"[try] AD={ad_name} OCPU={ocpus} MEM={mem_gb}GB")
        details = oci.core.models.LaunchInstanceDetails(
            availability_domain=ad_name,
            compartment_id=compartment,
            shape="VM.Standard.A1.Flex",
            shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
                ocpus=ocpus,
                memory_in_gbs=mem_gb,
            ),
            display_name=display,
            source_details=oci.core.models.InstanceSourceViaImageDetails(
                source_type="image",
                image_id=image,
                boot_volume_size_in_gbs=boot_gb,
            ),
            create_vnic_details=oci.core.models.CreateVnicDetails(
                subnet_id=subnet,
                assign_public_ip=True,
            ),
            metadata={"ssh_authorized_keys": ssh_pub},
        )
        try:
            res = compute.launch_instance(launch_instance_details=details)
            inst = res.data
            print(f"[SUCCESS] Instance launched: {inst.id}")
            print(f"  Name: {inst.display_name}")
            print(f"  Shape: {inst.shape}")
            print(f"  State: {inst.lifecycle_state}")
            notify(
                f"🎉 ARM Always Free 인스턴스 생성 성공!\n"
                f"이름: {inst.display_name}\n"
                f"Shape: {inst.shape} ({ocpus} OCPU + {mem_gb}GB)\n"
                f"OCID: {inst.id[:30]}...\n\n"
                f"Console에서 Public IP 확인 후 SSH 접속 가능합니다.\n"
                f"AMD에서 ARM으로 마이그레이션 진행하세요."
            )
            return True
        except oci.exceptions.ServiceError as e:
            msg = str(e.message)
            if "Out of host capacity" in msg or "capacity" in msg.lower():
                print(f"[try] AD={ad_name}: out of capacity (silent retry)")
                continue
            elif "LimitExceeded" in str(e.code):
                print(f"[FATAL] LimitExceeded — Free tier ARM 한도 초과")
                notify(
                    "⚠️ ARM Free Tier 한도 초과. 이미 사용 중인 ARM 인스턴스가 있거나 "
                    "한도(4 OCPU / 24GB)에 도달했습니다."
                )
                return False
            else:
                print(f"[ERROR] AD={ad_name}: {e.code} — {msg}")
                continue

    return False


def main() -> int:
    config = build_config()
    try:
        oci.config.validate_config(config)
    except Exception as e:
        print(f"[FATAL] Invalid OCI config: {e}")
        return 2

    identity = oci.identity.IdentityClient(config)
    compute = oci.core.ComputeClient(config)
    compartment = env("OCI_COMPARTMENT_ID")

    if already_has_arm(compute, compartment):
        print("[skip] ARM instance already exists.")
        return 0

    success = try_launch_arm(compute, identity, config)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
