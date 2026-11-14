#!/usr/bin/env python3
"""Build the four voice clips (M2-M5) from audio_script.json.

Engine: `lumina-tts` (offline Kokoro neural TTS) + ffmpeg phone-line filtering.
This is the record of HOW the shipped clips were made. You do not need to run it
to use the app: the MP3s are already in public/media/audio/.

To replace a clip with your own recording (for example from Mei's voice app),
just overwrite public/media/audio/m2.mp3 ... m5.mp3. No code change is needed.
Keep the clip under 30 seconds and keep the transcript in content/scenarios.json
in sync with what is said.

Usage:  python scripts/audio/generate_audio.py [M2 M3 ...]
"""
import json, subprocess, sys, tempfile, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "audio" / "audio_script.json"
OUT = ROOT / "public" / "media" / "audio"


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def main(only):
    data = json.loads(SCRIPT.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for clip in data["clips"]:
        if only and clip["id"] not in only:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            tmp = pathlib.Path(tmp)
            parts = []
            for i, seg in enumerate(clip["segments"]):
                wav = tmp / f"seg{i}.wav"
                run(["lumina-tts", "--text", seg["text"], "--voice", seg["voice"],
                     "--speed", str(seg["speed"]), "--output", str(wav)])
                pause = seg.get("pause_before_ms", 0)
                if pause:
                    sil = tmp / f"sil{i}.wav"
                    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                         "-t", str(pause / 1000), str(sil)])
                    parts.append(sil)
                parts.append(wav)
            lst = tmp / "list.txt"
            lst.write_text("".join(f"file '{p}'\n" for p in parts))
            joined = tmp / "joined.wav"
            run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                 "-ar", "24000", "-ac", "1", str(joined)])
            target = OUT / f"{clip['id'].lower()}.mp3"
            run(["ffmpeg", "-y", "-i", str(joined), "-af", clip["filter"],
                 "-ar", "24000", "-ac", "1", "-b:a", "56k", str(target)])
            dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                  "-of", "csv=p=0", str(target)], capture_output=True, text=True).stdout.strip()
            print(f"{clip['id']} -> {target.relative_to(ROOT)}  {float(dur):.1f}s")


if __name__ == "__main__":
    main(set(a.upper() for a in sys.argv[1:]))
