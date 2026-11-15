#!/bin/bash
# macOS: double-click this file to start ByteRush.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
xattr -dr com.apple.quarantine . 2>/dev/null   # avoids repeated "unidentified developer" prompts for the files inside
clear
echo "⚡ ByteRush"
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "ByteRush needs Node.js (a free helper program) to run."
  if command -v brew >/dev/null 2>&1; then
    read -r -p "Install it now? [Y/n] " ANS
    if [[ -z "$ANS" || "$ANS" =~ ^[Yy] ]]; then
      brew install node || { echo "The installation failed."; read -r -p "Press Enter to close"; exit 1; }
    else
      read -r -p "Press Enter to close"; exit 1
    fi
  else
    echo "Opening the download page. Install the LTS version, then double-click this file again."
    open "https://nodejs.org/en/download"
    read -r -p "Press Enter to close"; exit 1
  fi
fi
node launcher/launch.mjs
STATUS=$?
if [ $STATUS -ne 0 ]; then echo; read -r -p "Press Enter to close"; fi
