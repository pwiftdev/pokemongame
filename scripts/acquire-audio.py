"""Acquire the curated CC0 audio set and build normalized browser assets. Requires ffmpeg and bsdtar (for the sand footstep archive)."""
import concurrent.futures
import hashlib
import json
import pathlib
import subprocess
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / 'scripts/data/audio-sources.json').read_text())
CACHE = ROOT / 'evidence/audio-sources'
OUT = ROOT / 'apps/client/public/assets/audio'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

def acquire(item):
    key, source = item
    path = CACHE / source['cache']
    if not path.exists():
        with urllib.request.urlopen(source['download'], timeout=90) as response:
            path.write_bytes(response.read())
    if source.get("sha256") and hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError(f"Source checksum mismatch: {key}")
    return key, path

paths = dict(concurrent.futures.ThreadPoolExecutor(4).map(acquire, PLAN['sources'].items()))

def convert(asset):
    source = PLAN['sources'][asset['source']]
    raw = paths[asset['source']]
    if 'member' in asset:
        if raw.suffix == '.7z':
            data = subprocess.check_output(['bsdtar', '-xOf', str(raw), asset['member']])
        else:
            with zipfile.ZipFile(raw) as archive:
                data = archive.read(asset['member'])
        raw = CACHE / (asset['id'] + pathlib.Path(asset['member']).suffix)
        raw.write_bytes(data)
    target = OUT / (asset['id'] + '.mp3')
    kind = asset['kind']
    filters = []
    if kind == 'ambience':
        duration = asset['seconds']
        overlap = min(1, duration / 4)
        # Rotate the head behind the body and crossfade the tail into it.
        filters = [f'atrim=start={asset["offset"]}:duration={duration},asetpts=PTS-STARTPTS,asplit=2[a][b];[a]atrim=start={overlap},asetpts=PTS-STARTPTS[body];[b]atrim=end={overlap},asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d={overlap}:c1=tri:c2=tri,loudnorm=I=-26:TP=-4:LRA=7']
    elif kind == 'music':
        filters = ['loudnorm=I=-20:TP=-3:LRA=11']
    else:
        filters = ['silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.005,loudnorm=I=-22:TP=-3:LRA=7,afade=t=in:d=0.003']
    if kind == 'effect' and 'seconds' in asset:
        duration = asset['seconds']
        fade = asset.get('fade', min(1, duration / 2))
        filters[0] += f',atrim=duration={duration},afade=t=out:st={duration-fade}:d={fade}'
    filters[0] += ',alimiter=limit=0.63:level=false'
    args = ['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-filter_complex', filters[0], '-ar', '44100' if kind == 'music' else '24000', '-ac', '2' if kind == 'music' else '1', '-codec:a', 'libmp3lame', '-b:a', '112k' if kind == 'music' else '64k', str(target)]
    subprocess.run(args, check=True)
    data = target.read_bytes()
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(target)], text=True))
    return dict(name=asset['id'], path=str(target.relative_to(ROOT)), creator=source['creator'], source=source['source'], download=source['download'], license=source['license'], date='2026-09-30', sha256=hashlib.sha256(data).hexdigest(), bytes=len(data), kind='audio', category=kind, duration=round(duration, 3), sourceMember=asset.get('member'), sourceSha256=source['sha256'], modifications='Loudness normalization, resampling and MP3 encoding; ambience excerpt with seam crossfade; effect leading-silence trim')

records = list(concurrent.futures.ThreadPoolExecutor(3).map(convert, PLAN['assets']))
manifest_path = ROOT / 'ASSET_MANIFEST.json'
manifest = [a for a in json.loads(manifest_path.read_text()) if not a['path'].startswith('apps/client/public/assets/audio/')]
manifest_path.write_text(json.dumps(manifest + records, indent=2) + '\n')
credits = ['WORLD OF POKEMON — AUDIO CREDITS', '', 'All recordings below are licensed CC0 1.0:', 'https://creativecommons.org/publicdomain/zero/1.0/', '', 'Edited for game playback: loudness, sample rate, encoding, ambient seams.', 'Creature vocalizations are adapted fantasy effects, not official Pokemon cries.', '']
for source in PLAN['sources'].values():
    credits.extend([source['creator'] + ' — ' + source['source'], 'Download: ' + source['download'], *(['Creator: ' + source['credit']] if 'credit' in source else []), ''])
(ROOT / 'apps/client/public/legal/AUDIO_CREDITS.txt').write_text('\n'.join(credits))
print(f'Prepared {len(records)} assets: {sum(r["bytes"] for r in records)/1e6:.2f} MB')
