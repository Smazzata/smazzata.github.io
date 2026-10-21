"""Verifica locale AAB: ZIP, firma JAR, digest e manifest protobuf; niente upload."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile


def fields(data):
    pos = 0

    def varint():
        nonlocal pos
        value = shift = 0
        while True:
            byte = data[pos]
            pos += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value
            shift += 7

    out = []
    while pos < len(data):
        key = varint()
        number, wire = key >> 3, key & 7
        if wire == 0:
            value = varint()
        elif wire == 2:
            length = varint()
            value = data[pos:pos + length]
            pos += length
        elif wire in (1, 5):
            length = 8 if wire == 1 else 4
            value = data[pos:pos + length]
            pos += length
        else:
            raise ValueError("Protobuf wire non supportato")
        out.append((number, value))
    return out


def xml_node(data):
    element = next(v for n, v in fields(data) if n == 1)
    attrs, children, name = {}, [], ""
    for n, v in fields(element):
        if n == 3:
            name = v.decode()
        elif n == 4:
            attr = dict(fields(v))
            attrs[attr[2].decode()] = attr.get(3, b"").decode()
        elif n == 5:
            # I nodi testuali non hanno element; non servono per il manifest.
            if any(k == 1 for k, _ in fields(v)):
                children.append(xml_node(v))
    return {"name": name, "attributes": attrs, "children": children}


def sections(raw):
    text = raw.decode().replace("\r\n", "\n").replace("\n ", "")
    return [dict(line.split(": ", 1) for line in part.splitlines() if ": " in line)
            for part in text.strip().split("\n\n")]


def verify(file, openssl):
    with zipfile.ZipFile(file) as z:
        assert z.testzip() is None, "ZIP corrotto"
        mf = z.read("META-INF/MANIFEST.MF")
        rsa = next(n for n in z.namelist() if n.upper().endswith(".RSA") and n.startswith("META-INF/"))
        sf = z.read(rsa[:-4] + ".SF")
        assert sections(sf)[0]["SHA-256-Digest-Manifest"] == base64.b64encode(hashlib.sha256(mf).digest()).decode(), "Digest manifest non valido"
        checked = set()
        for entry in sections(mf)[1:]:
            name = entry["Name"]
            assert entry["SHA-256-Digest"] == base64.b64encode(hashlib.sha256(z.read(name)).digest()).decode(), "Digest non valido: " + name
            checked.add(name)
        for name in z.namelist():
            if not name.endswith("/") and not name.startswith("META-INF/"):
                assert name in checked, "File non coperto dalla firma: " + name
        with tempfile.TemporaryDirectory(prefix="smazzata-firma-") as d:
            d = Path(d)
            (d / "firma.RSA").write_bytes(z.read(rsa))
            (d / "firma.SF").write_bytes(sf)
            check = subprocess.run([openssl, "cms", "-verify", "-binary", "-inform", "DER", "-in", str(d / "firma.RSA"), "-content", str(d / "firma.SF"), "-noverify", "-out", str(d / "verificato.SF")], capture_output=True)
            assert check.returncode == 0, "Verifica crittografica firma non riuscita: " + check.stderr.decode()
        manifest = xml_node(z.read("base/manifest/AndroidManifest.xml"))
        sdk = next(c["attributes"] for c in manifest["children"] if c["name"] == "uses-sdk")
        permissions = [c["attributes"].get("name") for c in manifest["children"] if c["name"].startswith("uses-permission")]
        config = json.loads(z.read("base/assets/capacitor.config.json"))
        return {"file": str(file), "sha256": hashlib.sha256(Path(file).read_bytes()).hexdigest(), "bytes": Path(file).stat().st_size,
                "firma_crittografica_valida": True, "file_con_digest_verificato": len(checked), "manifest": manifest["attributes"], "sdk": sdk,
                "permissions": permissions, "store_user_agent": "SmazzataStore" in config.get("appendUserAgent", ""),
                "privacy_aggiornata": "21 ottobre 2026" in z.read("base/assets/public/gioca/privacy.html").decode(),
                "nota": "Verifica della firma interna, non dell'identità della chiave registrata in Play Console né del suo certificato di fiducia."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("aab")
    parser.add_argument("--openssl", default=shutil.which("openssl") or "C:/Program Files/Git/usr/bin/openssl.exe")
    parser.add_argument("--output")
    args = parser.parse_args()
    result = verify(args.aab, args.openssl)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(text + "\n", encoding="utf-8")
    print(text)
