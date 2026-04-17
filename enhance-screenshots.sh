#!/bin/bash
# Enhance App Store screenshots with marketing headlines
set -e

BASE_DIR="/Users/omeryasironal/Projects/GAMES/grow-io"
IN_DIR="$BASE_DIR/screenshots"
OUT_EN="$BASE_DIR/fastlane/screenshots/en-US"
OUT_TR="$BASE_DIR/fastlane/screenshots/tr"
FONT_IMPACT="/System/Library/Fonts/Supplemental/Impact.ttf"
FONT_FUTURA="/System/Library/Fonts/Supplemental/Futura.ttc"

# Titles per screenshot index (1-5)
EN_TITLES=("GROW YOUR SNAKE" "52 UNIQUE SKINS" "EPIC POWER-UPS" "CLIMB THE RANKS" "COMBO x3 MULTIPLIER")
EN_SUBS=("Tiny worm to mighty beast" "Neon . Rainbow . Rare" "Speed . Shield . Magnet . Ghost" "Top 10 Leaderboard" "Chain pickups for bonus")

TR_TITLES=("YILANINI BUYUT" "52 BENZERSIZ SKIN" "EFSANE POWER-UPLAR" "LIDER TABLOSU" "COMBO x3 CARPAN")
TR_SUBS=("Minik solucandan dev canavara" "Neon . Gokkusagi . Nadir" "Hiz . Kalkan . Miknatis . Hayalet" "En iyi 10 skor" "Ard arda topla bonus kazan")

enhance_one() {
    local in_file="$1"
    local out_file="$2"
    local title="$3"
    local subtitle="$4"
    local w=$(magick identify -format "%w" "$in_file")
    local h=$(magick identify -format "%h" "$in_file")
    # top banner height ~18% of h
    local bh=$((h * 18 / 100))
    # Dark gradient overlay at top + text
    magick "$in_file" \
        \( -size ${w}x${bh} gradient:'rgba(10,10,46,0.95)-rgba(10,10,46,0.0)' \) \
        -gravity north -composite \
        -font "$FONT_IMPACT" \
        -gravity north -pointsize $((w / 12)) \
        -fill '#00e5ff' -stroke '#003d4f' -strokewidth 3 \
        -annotate +0+$((bh / 7)) "$title" \
        -font "$FONT_FUTURA" -pointsize $((w / 25)) \
        -fill 'white' -stroke 'none' \
        -annotate +0+$((bh / 7 + w / 10)) "$subtitle" \
        "$out_file"
}

mkdir -p "$OUT_EN" "$OUT_TR"

for i in 1 2 3 4 5; do
    idx=$((i - 1))
    echo "Processing $i..."
    # iPhone EN
    enhance_one "$IN_DIR/iphone_$i.png" "$OUT_EN/6.5_$i.png" "${EN_TITLES[$idx]}" "${EN_SUBS[$idx]}"
    # iPad EN
    enhance_one "$IN_DIR/ipad_$i.png" "$OUT_EN/12.9_$i.png" "${EN_TITLES[$idx]}" "${EN_SUBS[$idx]}"
    # iPhone TR
    enhance_one "$IN_DIR/iphone_$i.png" "$OUT_TR/6.5_$i.png" "${TR_TITLES[$idx]}" "${TR_SUBS[$idx]}"
    # iPad TR
    enhance_one "$IN_DIR/ipad_$i.png" "$OUT_TR/12.9_$i.png" "${TR_TITLES[$idx]}" "${TR_SUBS[$idx]}"
done

echo "DONE. Outputs in $OUT_EN and $OUT_TR"
