#!/usr/bin/env bash
# Compiles every custom GLSL program in a real WebGL2 context (headless Chromium).  Needs: python3 + `pip install playwright && playwright install chromium`
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsc -p tests/tsconfig.json >/dev/null || true
node -e "require('fs').writeFileSync('.test-out/shaders.json', JSON.stringify(require('./.test-out/src/lib/3d/shaders.js')))"
python3 tests/shader-compile.py .test-out/shaders.json
