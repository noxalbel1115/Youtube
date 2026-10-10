"""Sintese local com Kokoro-82M (pesos Apache-2.0) via kokoro-onnx.

Entrada (stdin, JSON): {"model": "...onnx", "voicesDir": "...", "lang": "pt-br",
                        "items": [{"id": "s01", "text": "...", "voice": "pm_alex", "speed": 0.95, "out": "/abs/s01.wav"}]}
Saida (stdout, JSON): {"items": [{"id": "s01", "out": "...", "seconds": 3.21, "sampleRate": 24000}]}
"""
import json
import os
import sys
import tempfile

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


def load_voices(voices_dir, names):
    # Os arquivos .bin do repositorio onnx-community sao float32 crus no formato (510, 1, 256).
    data = {}
    for n in names:
        raw = np.fromfile(os.path.join(voices_dir, f"{n}.bin"), dtype=np.float32)
        data[n] = raw.reshape(-1, 1, 256)
    fd, npz = tempfile.mkstemp(suffix=".npz")
    os.close(fd)
    np.savez(npz, **data)
    return npz


def main():
    req = json.load(sys.stdin)
    names = sorted({it["voice"] for it in req["items"]})
    npz = load_voices(req["voicesDir"], names)
    try:
        k = Kokoro(req["model"], npz)
        out = []
        for it in req["items"]:
            samples, sr = k.create(it["text"], voice=it["voice"], speed=float(it.get("speed", 1.0)), lang=req.get("lang", "pt-br"))
            samples = np.asarray(samples, dtype=np.float32)
            sf.write(it["out"], samples, sr, subtype="PCM_16")
            out.append({"id": it["id"], "out": it["out"], "seconds": len(samples) / sr, "sampleRate": sr})
        json.dump({"items": out}, sys.stdout)
    finally:
        os.unlink(npz)


if __name__ == "__main__":
    main()
