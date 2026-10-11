"""Transcricao com faster-whisper (verificacao de pronuncia e tempos de palavra).

Uso: python asr.py [--lang pt|en] MODEL_NAME arquivo1.wav [arquivo2.wav ...]   (idioma padrao: pt)
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
    args = sys.argv[1:]
    lang = "pt"
    if args[:1] == ["--lang"]:
        lang, args = args[1], args[2:]
    model = WhisperModel(args[0], device="cpu", compute_type="int8")
    out = []
    for f in args[1:]:
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
