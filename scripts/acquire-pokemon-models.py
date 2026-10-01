"""Acquire the catalog's species models from a pinned source revision."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REVISION = "429de1288cea0d43f5b4f56305d2276e94239d65"
SOURCE = "https://github.com/Pokemon-3D-api/assets"
CATALOG = json.loads((ROOT / "packages/shared/pokemon-source.json").read_text())
CACHE = ROOT / "evidence/pokemon-source"
CACHE.mkdir(parents=True, exist_ok=True)
manifest_path = ROOT / "ASSET_MANIFEST.json"
manifest = json.loads(manifest_path.read_text())


def write_model(data, model, filename):
    length = struct.unpack_from("<I", data, 12)[0]
    document = json.dumps(model, separators=(",", ":")).encode()
    document += b" " * (-len(document) % 4)
    binary = data[20 + length:]
    prepared = CACHE / filename
    prepared.write_bytes(
        struct.pack("<III", 0x46546C67, 2, 20 + len(document) + len(binary))
        + struct.pack("<II", len(document), 0x4E4F534A) + document + binary
    )
    return prepared


def prepare_dragonite(original):
    data = original.read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    model = json.loads(data[20:20 + length])
    clips = {
        "00000_defaultwait01_loop": "Idle", "00010_defaultidle01": "Idle_Variant",
        "00030_walk01_loop": "Walk", "00100_run01_loop": "Run",
        "20400_attack01": "Bite_InPlace", "20410_attack02": "Attack_Alt",
        "20450_rangeattack01": "Special", "20500_damage01": "HitReact",
        "20520_down01_start": "Death", "00550_glad01": "Dance",
        "00281_sleep01_loop": "Sleep",
    }
    kept = []
    for animation in model["animations"]:
        suffix = animation["name"].removeprefix("pm0149_00_00_")
        if suffix in clips:
            animation["name"] = clips[suffix]
            kept.append(animation)
    if len(kept) != len(clips):
        raise ValueError("Dragonite authored animation catalog changed")
    model["animations"] = kept
    return write_model(data, model, "Dragonite-game.glb")


def prepare_pose(original, name):
    data = original.read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    model = json.loads(data[20:20 + length])
    if name == "Blastoise":
        alternate = next(i for i, node in enumerate(model["nodes"]) if node.get("name") == "Blastoise_CannonsA")
        model["scenes"][0]["nodes"].remove(alternate)
        for node in model["nodes"]:
            if node.get("name") == "Blastoise_CannonsB":
                node["extras"] = {"excludeFromBounds": True}
    else:
        animation = model["animations"][0]
        for channel in animation["channels"]:
            path = channel["target"]["path"]
            if path not in {"translation", "rotation", "scale"}:
                continue
            sampler = animation["samplers"][channel["sampler"]]
            accessor = model["accessors"][sampler["output"]]
            count = 4 if path == "rotation" else 3
            if "bufferView" not in accessor and "sparse" not in accessor:
                model["nodes"][channel["target"]["node"]][path] = [0] * count
                continue
            if "sparse" in accessor:
                raise ValueError(f"Unsupported sparse source pose: {name}")
            view = model["bufferViews"][accessor["bufferView"]]
            if accessor["componentType"] != 5126 or sampler.get("interpolation", "LINEAR") == "CUBICSPLINE":
                raise ValueError(f"Unsupported source pose: {name}")
            offset = 28 + length + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            model["nodes"][channel["target"]["node"]][path] = list(struct.unpack_from(f"<{count}f", data, offset))
    return write_model(data, model, f"{name}-posed.glb")


def acquire(species):
    name = species["id"].capitalize()
    path = f"apps/client/public/assets/pokemon/{name}.glb"
    destination = ROOT / path
    repaired = name in {
        "Blastoise", "Pikachu", "Eevee", "Vaporeon", "Jolteon", "Flareon"
    }
    existing = next((entry for entry in manifest if entry["path"] == path), None)
    optimized = name == "Dragonite"
    prepared = existing and (not repaired or existing.get("preparedPose") == 2)
    pruned = existing and (
        not optimized or existing.get("generatedBy") == "scripts/acquire-pokemon-models.py"
    )
    if existing and destination.exists() and prepared and pruned:
        if hashlib.sha256(destination.read_bytes()).hexdigest() != existing["sha256"]:
            raise ValueError(f"Existing model hash mismatch: {name}")
        return existing
    url = f"https://raw.githubusercontent.com/Pokemon-3D-api/assets/{REVISION}/models/opt/regular/{species['number']}.glb"
    original = CACHE / f"{name}.glb"
    with urllib.request.urlopen(url, timeout=60) as response:
        original.write_bytes(response.read())
    if optimized:
        original = prepare_dragonite(original)
    if repaired:
        original = prepare_pose(original, name)
    subprocess.run(
        [
            "npx", "--yes", "@gltf-transform/cli@4.2.1",
            "prune" if optimized or repaired else "copy", str(original), str(destination),
        ],
        cwd=ROOT, stdout=subprocess.DEVNULL, check=True,
    )
    data = destination.read_bytes()
    print(f"{name}: {len(data)} bytes", flush=True)
    return {
        "name": name, "path": path,
        "creator": "Nintendo / Creatures Inc. / GAME FREAK inc.",
        "source": SOURCE, "download": url,
        "license": "LicenseRef-Pokemon-Rights-Reserved", "kind": "model",
        "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        "modifications": "Draco decompressed; original rig and materials preserved" + (
            "; retained and named eleven authored game animations, pruned unused buffers" if optimized else "") + ("; selected retracted cannon variant" if name == "Blastoise" else "; initialized rig from authored first pose" if repaired else ""),
        "preparedPose": 2 if repaired else 0,
        "generatedBy": "scripts/acquire-pokemon-models.py",
        "sourceFormat": "glb", "decodeDraco": True,
    }


with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    models = list(executor.map(acquire, CATALOG))
paths = {entry["path"] for entry in models}
obsolete = "apps/client/public/assets/pokemon/procedural-placeholders.json"
manifest = [entry for entry in manifest if entry["path"] not in paths | {obsolete}]
manifest.extend(models)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
(ROOT / obsolete).unlink(missing_ok=True)
