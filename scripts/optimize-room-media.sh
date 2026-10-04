#!/usr/bin/env bash
# V3.3 — web derivatives for THE HOODDINO ROOM. Inputs: the supplied media pack (originals are never modified).
# usage: scripts/optimize-room-media.sh /path/to/media-pack
set -euo pipefail
SRC="${1:?media pack dir}"
OUT="$(dirname "$0")/../public/room"
mkdir -p "$OUT"
# photographs: a 'lo' tier (fetched on approach) and a 'hi' tier (fetched on room entry)
conv() { convert "$SRC/$1" -auto-orient -strip -resize "$3x>" -quality "$4" -define webp:method=6 "$OUT/$2"; }
conv HOODDINO_PHOTO_02.jpg portrait-lo.webp 384 74
conv HOODDINO_PHOTO_02.jpg portrait-hi.webp 1024 82
conv HOODDINO_PHOTO_01.jpg live-lo.webp 384 74
conv HOODDINO_PHOTO_01.jpg live-hi.webp 1024 82
conv HOODDINO_PHOTO_03.jpg signal-lo.webp 256 74
conv HOODDINO_PHOTO_03.jpg signal-hi.webp 768 82
# poster still of the video (the only video-related file fetched before the visitor presses PLAY)
ffmpeg -v error -y -ss 55 -i "$SRC/HOODDINO_STUDIO_ARRANGIAMENTO_WEB.mp4" -frames:v 1 "$OUT/.poster.png"
convert "$OUT/.poster.png" -strip -quality 80 -define webp:method=6 "$OUT/studio-poster.webp"
rm -f "$OUT/.poster.png"
# the supplied web delivery file is already H.264 High / AAC-LC with the moov atom first (progressive start) → shipped byte-for-byte
cp "$SRC/HOODDINO_STUDIO_ARRANGIAMENTO_WEB.mp4" "$OUT/hooddino-studio-arrangiamento.mp4"
