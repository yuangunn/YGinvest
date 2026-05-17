"""Plan #46.3: ap-chuncheon-1 (또는 임의 region)에서 ARM-호환 Ubuntu 22.04 image OCID 조회.

env 파일에서 OCI 자격증명 읽어 list_images로 Canonical Ubuntu 22.04 aarch64 검색.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import oci  # type: ignore


def parse_env_file(path: Path) -> dict[str, str]:
    """간단 .env 파서 — heredoc(KEY<<EOF ... EOF) 지원."""
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


def main() -> int:
    env_path = Path.home() / "oci-arm-secrets.env"
    if not env_path.exists():
        print(f"[FATAL] env file not found: {env_path}")
        return 2
    env = parse_env_file(env_path)

    required = [
        "OCI_USER_OCID",
        "OCI_TENANCY_OCID",
        "OCI_REGION",
        "OCI_FINGERPRINT",
        "OCI_PRIVATE_KEY",
        "OCI_COMPARTMENT_ID",
    ]
    missing = [k for k in required if not env.get(k)]
    if missing:
        print(f"[FATAL] Missing: {missing}")
        return 2

    config = {
        "user": env["OCI_USER_OCID"],
        "tenancy": env["OCI_TENANCY_OCID"],
        "region": env["OCI_REGION"],
        "fingerprint": env["OCI_FINGERPRINT"],
        "key_content": env["OCI_PRIVATE_KEY"],
    }
    try:
        oci.config.validate_config(config)
    except Exception as e:
        print(f"[FATAL] Invalid OCI config: {e}")
        return 2

    compute = oci.core.ComputeClient(config)

    # ARM (aarch64) Ubuntu 22.04 검색
    print(
        f"[search] region={env['OCI_REGION']} OS=Canonical Ubuntu 22.04 shape=VM.Standard.A1.Flex"
    )
    try:
        images = compute.list_images(
            compartment_id=env["OCI_COMPARTMENT_ID"],
            operating_system="Canonical Ubuntu",
            operating_system_version="22.04",
            shape="VM.Standard.A1.Flex",
            sort_by="TIMECREATED",
            sort_order="DESC",
            limit=10,
        ).data
    except oci.exceptions.ServiceError as e:
        print(f"[FATAL] OCI API error: {e.code} — {e.message}")
        return 3

    if not images:
        print("[FATAL] No ARM Ubuntu 22.04 images found in this region")
        return 4

    print(f"[found] {len(images)} images:")
    print()
    for i, img in enumerate(images, 1):
        marker = "  ★" if i == 1 else "   "
        print(f"{marker} #{i}: {img.display_name}")
        print(f"     OCID:    {img.id}")
        print(f"     Created: {img.time_created}")
        print()

    latest = images[0]
    print(f"=== LATEST IMAGE OCID ===")
    print(latest.id)
    print()
    print(f"sed 명령어로 env 파일 업데이트:")
    print(f"  sed -i 's|^OCI_IMAGE_OCID=.*|OCI_IMAGE_OCID={latest.id}|' "
          f"~/oci-arm-secrets.env")
    return 0


if __name__ == "__main__":
    sys.exit(main())
