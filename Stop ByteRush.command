#!/bin/bash
# Stops the background ByteRush server (only needed if you want to free it up; it is lightweight).
PID_FILE="$HOME/ByteRush-Data/byterush.pid"
[ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null && rm -f "$PID_FILE" && echo "ByteRush stopped." || echo "ByteRush was not running."
sleep 1
