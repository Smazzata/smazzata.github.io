"""Estrae l'impronta del firmatario AAB e la confronta con la chiave pubblica APK.

Non accede a Play Console o a chiavi upload private. Richiede solo Python standard e OpenSSL.
"""
import argparse
import json
import hashlib
import re
import ssl
import shutil
from pathlib import Path
import subprocess
import tempfile
import zipfile


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
        # Il certificato dell'APK è pubblico: estraiamo solo il certificato, mai la chiave.
        apk = subprocess.run([openssl, 'pkcs12', '-in', str(root / 'android-app/burraco.p12'),
                              '-passin', 'pass:burraco-amici', '-clcerts', '-nokeys'], capture_output=True)
        if apk.returncode:
            raise ValueError('Certificato pubblico APK non leggibile: ' + apk.stderr.decode())
        public_pem = re.search(rb'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----', apk.stdout, re.S)
        if not public_pem:
            raise ValueError('Certificato pubblico APK assente')
        def public_key(cert):
            extract = subprocess.run([openssl, 'x509', '-pubkey', '-noout'], input=cert, capture_output=True, check=True)
            return subprocess.run([openssl, 'pkey', '-pubin', '-outform', 'DER'], input=extract.stdout, capture_output=True, check=True).stdout
        def fingerprint(cert):
            return hashlib.sha256(ssl.PEM_cert_to_DER_cert(cert.decode())).hexdigest().upper()
        distinct = public_key(pem) != public_key(public_pem.group())
        upload_fingerprint = fingerprint(pem)
        apk_fingerprint = fingerprint(public_pem.group())
    report = {
        'aab': Path(aab).name,
        'upload_certificate_sha256': upload_fingerprint,
        'public_apk_certificate_sha256': apk_fingerprint,
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
    parser.add_argument('--openssl', default=shutil.which('openssl') or 'C:/Program Files/Git/usr/bin/openssl.exe')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = verify(args.aab, args.openssl)
    Path(args.output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
