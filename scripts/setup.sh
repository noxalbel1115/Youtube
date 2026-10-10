#!/usr/bin/env bash
# Instala dependencias locais: venv Python e modelos de voz/ASR (revisoes fixadas, hash verificado).
# Idempotente: arquivos ja baixados e com hash correto nao sao baixados de novo.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v ffmpeg >/dev/null || { echo "ERRO: ffmpeg nao encontrado (apt-get install -y ffmpeg)"; exit 1; }
command -v node >/dev/null || { echo "ERRO: Node >= 20 necessario"; exit 1; }

[ -d node_modules ] || npm ci

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r python/requirements.txt

KOKORO_REV=1939ad2a8e416c0acfeecc08a694d14ef25f2231   # onnx-community/Kokoro-82M-v1.0-ONNX (Apache-2.0)
BASE="https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/${KOKORO_REV}"
mkdir -p models/kokoro/voices

fetch() { # url destino sha256
  local url="$1" dest="$2" sum="$3"
  if [ -f "$dest" ] && echo "$sum  $dest" | sha256sum -c --quiet 2>/dev/null; then return 0; fi
  echo "baixando $(basename "$dest")..."
  curl -fsSL --retry 4 -o "$dest.part" "$url"
  echo "$sum  $dest.part" | sha256sum -c --quiet
  mv "$dest.part" "$dest"
}

fetch "$BASE/onnx/model.onnx"        models/kokoro/model.onnx           8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb
fetch "$BASE/voices/pm_alex.bin"     models/kokoro/voices/pm_alex.bin   0175c753f59c54e7fd5a995bedef0c5ff2fb67e0043dd3dcb2ae74ec2acbeb2a
fetch "$BASE/voices/pm_santa.bin"    models/kokoro/voices/pm_santa.bin  8b012db3185778afe2e45a62cbad69db73021774fe68dda634bcc748a982eede
fetch "$BASE/voices/pf_dora.bin"     models/kokoro/voices/pf_dora.bin   3da7b5b2d91847ebf5646f57631af6ececae3c29a89cd300f06edf9aa6cfe9ee

# Modelo de ASR (faster-whisper small, MIT) e baixado no primeiro uso para ~/.cache/huggingface.
.venv/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')" >/dev/null
echo "setup ok"
