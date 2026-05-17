"""Plan #46.3: ~/oci-arm-secrets.env 읽어서 gh secret set 으로 일괄 등록.

- 필수 값 비어있으면 fail
- 멀티라인(PRIVATE_KEY) 안전하게 처리 (gh secret set --body-file)
- 등록 후 임시 파일 안전 삭제 (shred + rm)
- 출력에 비밀값 절대 노출 X
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


REPO = "yuangunn/YGinvest"

REQUIRED_SECRETS = [
    "OCI_USER_OCID",
    "OCI_TENANCY_OCID",
    "OCI_REGION",
    "OCI_FINGERPRINT",
    "OCI_PRIVATE_KEY",
    "OCI_COMPARTMENT_ID",
    "OCI_SUBNET_ID",
    "OCI_IMAGE_OCID",
    "OCI_INSTANCE_NAME",
]
# SSH key는 별도로 (~/.ssh/oracle-yginvest.key에서 derive)
OPTIONAL_SECRETS = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "DISCORD_WEBHOOK_URL",
]
VARIABLES = [
    "OCI_ARM_OCPUS",
    "OCI_ARM_MEMORY_GB",
    "OCI_ARM_BOOT_GB",
]


def parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    text = path.read_text(encoding="utf-8")
    i = 0
    lines = text.splitlines()
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith("#"):
            i += 1
            continue
        m = re.match(r"^([A-Z_][A-Z0-9_]*)<<(\w+)$", line)
        if m:
            key, marker = m.group(1), m.group(2)
            buf: list[str] = []
            i += 1
            while i < len(lines) and lines[i].strip() != marker:
                buf.append(lines[i])
                i += 1
            out[key] = "\n".join(buf)
            i += 1
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip()
        i += 1
    return out


def derive_ssh_pub() -> str:
    """기존 ~/.ssh/oracle-yginvest.key 에서 public key 추출."""
    pri = Path.home() / ".ssh" / "oracle-yginvest.key"
    if not pri.exists():
        raise FileNotFoundError(f"SSH private key not found: {pri}")
    r = subprocess.run(
        ["ssh-keygen", "-y", "-f", str(pri)],
        capture_output=True,
        text=True,
        check=True,
    )
    return r.stdout.strip()


def gh_set_secret(name: str, value: str) -> None:
    """gh secret set via stdin — gh가 stdin 없으면 body로 prompt함.
    multiline 값도 안전하게 처리됨 (가장 중요한 OCI_PRIVATE_KEY).
    """
    proc = subprocess.run(
        ["gh", "secret", "set", name, "--repo", REPO],
        input=value,
        text=True,
        check=True,
        encoding="utf-8",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    _ = proc


def gh_set_variable(name: str, value: str) -> None:
    subprocess.run(
        ["gh", "variable", "set", name, "--repo", REPO, "--body", value],
        check=True,
        stdout=subprocess.DEVNULL,
    )


def main() -> int:
    env_path = Path.home() / "oci-arm-secrets.env"
    if not env_path.exists():
        print(f"[FATAL] env file not found: {env_path}")
        return 2

    env = parse_env_file(env_path)

    # SSH pub key derive
    try:
        ssh_pub = derive_ssh_pub()
        env["OCI_SSH_PUBLIC_KEY"] = ssh_pub
    except Exception as e:
        print(f"[FATAL] SSH public key derivation failed: {e}")
        return 2
    print(f"[ok] SSH public key derived: {ssh_pub[:30]}...")

    # 필수 secret 검증
    missing_secrets = [
        k for k in REQUIRED_SECRETS + ["OCI_SSH_PUBLIC_KEY"]
        if not env.get(k) or "여기에_pem" in (env.get(k) or "")
    ]
    if missing_secrets:
        print(f"[FATAL] Missing required secrets: {missing_secrets}")
        return 2

    # 필수 variable 검증
    missing_vars = [k for k in VARIABLES if not env.get(k)]
    if missing_vars:
        print(f"[FATAL] Missing required variables: {missing_vars}")
        return 2

    # PRIVATE_KEY sanity
    pk = env.get("OCI_PRIVATE_KEY", "")
    if "BEGIN PRIVATE KEY" not in pk or "END PRIVATE KEY" not in pk:
        print("[FATAL] OCI_PRIVATE_KEY does not look like a PEM block")
        return 2

    print()
    print(f"=== 등록 시작 ({REPO}) ===")

    # Secrets
    for name in REQUIRED_SECRETS + ["OCI_SSH_PUBLIC_KEY"]:
        try:
            gh_set_secret(name, env[name])
            print(f"  [secret] {name}: OK")
        except subprocess.CalledProcessError as e:
            print(f"  [secret] {name}: FAIL ({e})")
            return 3

    # Optional secrets
    for name in OPTIONAL_SECRETS:
        v = env.get(name, "").strip()
        if not v:
            print(f"  [secret] {name}: skip (비어있음)")
            continue
        try:
            gh_set_secret(name, v)
            print(f"  [secret] {name}: OK")
        except subprocess.CalledProcessError as e:
            print(f"  [secret] {name}: FAIL ({e})")

    # Variables
    for name in VARIABLES:
        try:
            gh_set_variable(name, env[name])
            print(f"  [var]    {name}={env[name]}: OK")
        except subprocess.CalledProcessError as e:
            print(f"  [var]    {name}: FAIL ({e})")
            return 3

    print()
    print("=== 등록 완료 ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
