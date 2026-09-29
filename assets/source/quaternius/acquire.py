"""Reacquire the pinned assets in ASSET_MANIFEST.json (Python 3; macOS sips)."""
import base64
import concurrent.futures
import hashlib
import json
import pathlib
import struct
import subprocess
import tempfile
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[3]


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def acquire(entry):
    destination = ROOT / entry["path"]
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == entry["sha256"]:
        return
    if entry["kind"] == "portrait":
        raise ValueError("Regenerate portraits with node scripts/render-portraits.mjs while the dev server is running")
    if entry.get("generatedBy"):
        raise ValueError("Regenerate material variants with python3 " + entry["generatedBy"])
    raw = fetch(entry["download"])
    if entry.get("sourceFormat") == "obj":
        with tempfile.TemporaryDirectory() as folder:
            work = pathlib.Path(folder)
            (work / "Mill.obj").write_bytes(raw)
            (work / "Mill.mtl").write_bytes(fetch(entry["materialDownload"]))
            subprocess.run(["npx", "--yes", "obj2gltf@3.2.0", "-i", str(work / "Mill.obj"),
                            "-o", str(work / "Mill.glb"), "--binary"], check=True)
            raw = (work / "Mill.glb").read_bytes()
    elif entry["kind"] == "model" and entry.get("sourceFormat") != "glb":
        model = json.loads(raw)
        if len(model["buffers"]) != 1:
            raise ValueError("Expected a single glTF buffer")
        uri = model["buffers"][0].pop("uri")
        binary = (base64.b64decode(uri.split(",", 1)[1]) if uri.startswith("data:")
                  else fetch(urllib.parse.urljoin(entry["download"], urllib.parse.quote(uri))))
        binary += b"\0" * (-len(binary) % 4)
        document = json.dumps(model, separators=(",", ":")).encode()
        document += b" " * (-len(document) % 4)
        raw = (struct.pack("<III", 0x46546C67, 2, 28 + len(document) + len(binary))
               + struct.pack("<II", len(document), 0x4E4F534A) + document
               + struct.pack("<II", len(binary), 0x004E4942) + binary)
    if entry.get("decodeDraco"):
        with tempfile.TemporaryDirectory() as folder:
            source = pathlib.Path(folder) / "source.glb"
            target = pathlib.Path(folder) / "decoded.glb"
            source.write_bytes(raw)
            subprocess.run(["npx", "--yes", "@gltf-transform/cli@4.2.1", "copy", str(source), str(target)], check=True)
            raw = target.read_bytes()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.stem + ".download" + destination.suffix)
    try:
        temporary.write_bytes(raw)
        if entry["kind"] == "texture" and entry.get("sourceFormat") != "original-texture":
            subprocess.run(["sips", "-Z", "512", str(temporary)], check=True, stdout=subprocess.DEVNULL)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != entry["sha256"]:
            raise ValueError("Asset checksum mismatch: " + entry["path"])
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    entries = json.loads((ROOT / "ASSET_MANIFEST.json").read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(acquire, entries))
    print(f"Verified {len(entries)} packaged assets.")
