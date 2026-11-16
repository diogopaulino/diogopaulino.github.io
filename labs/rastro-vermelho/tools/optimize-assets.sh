#!/bin/sh
# Reproduz os .glb de assets/ a partir do Poly Haven (CC0).
# Uso: sh optimize-assets.sh <dir-de-trabalho-vazio> <dir-de-saida>
#   1) baixa o glTF 1k de cada asset (fetch-polyhaven.py) para <trabalho>/<id>/
#   2) glTF-Transform: weld + simplify (razão por asset; sem join: cada pedra/arbusto/barril segue um nó próprio) + texturas WebP + meshopt
# Requer python3 e node (npx @gltf-transform/cli@4). Nada disso entra no site.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$1"; OUT="$2"
# id : nome final : razão de simplificação : lado máximo da textura
LIST="
namaqualand_boulder_04:boulder:0.06:1024
namaqualand_cliff_01:cliff:0.06:1024
namaqualand_stones_01:stones:0.08:1024
quiver_tree_02:quiver-tree:0.05:1024
dead_tree_trunk:dead-trunk:0.05:1024
wooden_barrels_01:barrels:0.35:512
wooden_crate_02:crate:1:512
vintage_oil_lamp:oil-lamp:0.6:512
stone_fire_pit:fire-pit:1:512
"
for row in $LIST; do
    id="${row%%:*}"; rest="${row#*:}"; name="${rest%%:*}"; rest="${rest#*:}"; ratio="${rest%%:*}"; size="${rest#*:}"
    [ -d "$WORK/$id" ] || python3 -I "$HERE/fetch-polyhaven.py" "$id" "$WORK/$id"
    npx -y @gltf-transform/cli@4 optimize "$WORK/$id/$id.gltf" "$OUT/$name.glb" \
        --join false --compress meshopt --texture-compress webp --texture-size "$size" \
        --simplify-ratio "$ratio" --simplify-error 0.01 > /dev/null
    ls -l "$OUT/$name.glb" | awk '{print $5, $9}'
done

# Cavalo (Quaternius, CC0): horse.gltf original → horse.glb com meshopt, sem simplificar nem
# fundir materiais (os nomes Main/Hair/Hooves… escolhem a pelagem em actors.js):
#   npx -y @gltf-transform/cli@4 optimize horse.gltf horse.glb --compress meshopt \
#       --simplify false --join false --weld false --palette false
