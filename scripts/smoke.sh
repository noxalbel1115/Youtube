#!/usr/bin/env bash
# Teste de fumaca de ponta a ponta (sem rede): episodio-fixture de ~17 s em diretorio temporario.
# Espera-se que a verificacao reprove SOMENTE a duracao (o fixture e curto de proposito).
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
export DNN_EPISODES_DIR="$TMP/episodes" DNN_DATA_DIR="$TMP/data" DNN_CONFIG="$TMP/channel.json"
# Sem rede e sem custo: vozes locais (Kokoro), qualquer que seja a voz configurada para producao.
node -e '
const fs = require("fs");
const c = JSON.parse(fs.readFileSync("config/channel.json", "utf8"));
c.providers.tts.voices = {
  vendedor: {provider: "kokoro", voice: "pm_alex", speed: 1.04},
  colega: {provider: "kokoro", voice: "pf_dora", speed: 1.05},
  locutor: {provider: "kokoro", voice: "pm_santa", speed: 0.95},
};
fs.writeFileSync(process.argv[1], JSON.stringify(c));
' "$DNN_CONFIG"
ffmpeg -v error -f lavfi -i "testsrc2=s=1600x1200" -frames:v 1 "$TMP/img.jpg"
npm run -s dnn -- new ep000-smoke
mkdir -p "$DNN_EPISODES_DIR/ep000-smoke/research"
sed "s#/__SMOKE_IMG__#$TMP/img.jpg#" test/fixtures/smoke/candidates.json > "$DNN_EPISODES_DIR/ep000-smoke/research/candidates.json"
cp test/fixtures/smoke/script.json "$DNN_EPISODES_DIR/ep000-smoke/script.json"
set +e
npm run -s dnn -- run ep000-smoke --offline
set -e
node -e '
const r = require(process.argv[1]);
const failed = r.automatic.filter(c => !c.ok && c.severity === "error").map(c => c.id);
console.log("checks reprovados:", failed);
process.exit(failed.length === 1 && failed[0] === "formato.duracao" ? 0 : 1);
' "$DNN_EPISODES_DIR/ep000-smoke/verify-report.json"
echo "smoke ok ($TMP)"
