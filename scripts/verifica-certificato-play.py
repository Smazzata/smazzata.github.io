"""Estrae l'impronta del firmatario AAB e la confronta con la chiave pubblica APK.

Non accede a Play Console o a chiavi upload private. Richiede cryptography/OpenSSL.
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs12


def verify(aab, openssl):
    root = Path(__file__).resolve().parent.parent
    with zipfile.ZipFile(aab) as z, tempfile.TemporaryDirectory() as tmp:
        blocks = [n for n in z.namelist() if n.startswith('META-INF/') and n.upper().endswith('.RSA')]
        if len(blocks) != 1:
            raise ValueError('Atteso un solo blocco firma RSA')
        tmp = Path(tmp)
        (tmp / 'signature.der').write_bytes(z.read(blocks[0]))
        (tmp / 'signature.sf').write_bytes(z.read(blocks[0][:-4] + '.SF'))
        result = subprocess.run([openssl, 'cms', '-verify', '-binary', '-inform', 'DER',
                                 '-in', str(tmp / 'signature.der'), '-content', str(tmp / 'signature.sf'),
                                 '-noverify', '-signer', str(tmp / 'signer.pem'),
                                 '-out', str(tmp / 'verified.sf')], capture_output=True)
        if result.returncode:
            raise ValueError('Firma CMS non verificata')
        pem = (tmp / 'signer.pem').read_bytes()
        if pem.count(b'-----BEGIN CERTIFICATE-----') != 1:
            raise ValueError('Atteso un solo firmatario')
        signer = x509.load_pem_x509_certificate(pem)
    # Password della chiave APK già pubblicata nel repository, non un segreto upload.
    _, public_apk_cert, _ = pkcs12.load_key_and_certificates((root / 'android-app/burraco.p12').read_bytes(), b'burraco-amici')
    def public_key(cert):
        return cert.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    distinct = public_key(signer) != public_key(public_apk_cert)
    report = {
        'aab': Path(aab).name,
        'upload_certificate_sha256': signer.fingerprint(hashes.SHA256()).hex().upper(),
        'public_apk_certificate_sha256': public_apk_cert.fingerprint(hashes.SHA256()).hex().upper(),
        'upload_public_key_distinct_from_public_apk': distinct,
        'play_console_match': 'NON VERIFICATO: confrontare con certificato chiave di caricamento, non con chiave firma app di Google',
        'scope': 'Verifica aggiuntiva identità firmatario; non sostituisce la verifica completa dei digest AAB già eseguita.'
    }
    if not distinct:
        raise ValueError('BLOCCO: AAB firmato con la chiave pubblica APK')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('aab')
    parser.add_argument('--openssl', default='C:/Program Files/Git/usr/bin/openssl.exe')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = verify(args.aab, args.openssl)
    Path(args.output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
