#!/bin/bash
# Linux: ./start-byterush.sh  (or double-click it and choose "Run")
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "ByteRush needs Node.js 18 or newer. Install it from https://nodejs.org (or: sudo apt install nodejs npm), then run this again."
  exit 1
fi
node launcher/launch.mjs
