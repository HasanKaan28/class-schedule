"""Creates the PKCS#12 key that signs release APKs.

Usage: python tools/make_signing_key.py <output.p12>

Writes the key and, next to it, a .password.txt file. Keep both outside the repository:
losing them means a new key, and phones then have to uninstall the old app before updating.
"""
import datetime
import secrets
import sys
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

ALIAS = "release"


def main(out: Path) -> None:
    password = secrets.token_urlsafe(24)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Class Schedule")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=365 * 30))
        .sign(key, hashes.SHA256())
    )
    encryption = (
        serialization.PrivateFormat.PKCS12.encryption_builder()
        .kdf_rounds(50000)
        .key_cert_algorithm(pkcs12.PBES.PBESv2SHA256AndAES256CBC)
        .hmac_hash(hashes.SHA256())
        .build(password.encode())
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(pkcs12.serialize_key_and_certificates(ALIAS.encode(), key, cert, None, encryption))
    password_file = out.with_suffix(".password.txt")
    password_file.write_text(password)
    print(f"Wrote {out} and {password_file} (alias: {ALIAS})")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
