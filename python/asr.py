"""Transcricao com faster-whisper (verificacao de pronuncia e tempos de palavra).

Uso: python asr.py MODEL_NAME [--lang=pt] arquivo1.wav [arquivo2.wav ...]
Saida (stdout, JSON): {"files": [{"file": "...", "text": "...", "words": [{"word", "start", "end", "prob"}]}]}
"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel


def load(f):
    raw = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", f, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main():
    model = WhisperModel(sys.argv[1], device="cpu", compute_type="int8")
    args = sys.argv[2:]
    lang = "pt"
    if args and args[0].startswith("--lang="):
        lang = args.pop(0).split("=", 1)[1]
    out = []
    for f in args:
        segs, _info = model.transcribe(load(f), language=lang, beam_size=5, word_timestamps=True, vad_filter=False)
        words, texts = [], []
        for s in segs:
            texts.append(s.text.strip())
            for w in s.words or []:
                words.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)})
        out.append({"file": f, "text": " ".join(texts), "words": words})
    json.dump({"files": out}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
