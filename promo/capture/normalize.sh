#!/bin/bash
# Trim the interpolated (15 -> 30 fps) clips to their exact frame count (2 x rendered frames) without re-encoding.
cd "$(dirname "$0")/../footage"
declare -A N=( [s05_brahma]=180 [s08_zero]=180 [s09_return]=180 [s11_style_real]=90 [s11_style_fusion]=90 [s11_style_sumi]=90 [s11_style_neon]=90 [s11_style_paint]=90 [s12_carving]=120 [s13_rain]=120 [s14_moon]=120 [ui_v_dial_scrub]=120 [ui_h_dial_scrub]=120 )
for k in "${!N[@]}"; do
  f=$k.mp4; [ -f "$f" ] || continue
  have=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")
  if [ "$have" -gt "${N[$k]}" ]; then ffmpeg -loglevel error -y -i "$f" -frames:v ${N[$k]} -c copy -movflags +faststart "/tmp/claude-0/trim_$f" && mv "/tmp/claude-0/trim_$f" "$f"; echo "trimmed $k $have -> ${N[$k]}"; else echo "ok $k $have"; fi
done
