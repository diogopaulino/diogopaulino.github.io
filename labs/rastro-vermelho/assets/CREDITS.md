# Assets

Tudo aqui é CC0 (domínio público). Os `.glb` são gerados por `../tools/optimize-assets.sh`
(glTF-Transform: weld, simplify, texturas WebP ≤ 1K, compressão meshopt).

## Modelos

- `horse.glb` — Horse, Ultimate Animated Animal Pack, Quaternius, CC0.
  https://quaternius.com/packs/ultimateanimatedanimals.html
  Esqueleto e 13 animações originais; compactado com meshopt. Normais suavizadas,
  pelagem procedural e arreios são feitos em `src/actors.js`.
- Poly Haven, CC0 (https://polyhaven.com/license) — fotogrametria, glTF 1K:
  - `boulder.glb` — Namaqualand Boulder 04 — https://polyhaven.com/a/namaqualand_boulder_04
  - `cliff.glb` — Namaqualand Cliff 01 — https://polyhaven.com/a/namaqualand_cliff_01
  - `stones.glb` — Namaqualand Stones 01 — https://polyhaven.com/a/namaqualand_stones_01
  - `quiver-tree.glb` — Quiver Tree 02 — https://polyhaven.com/a/quiver_tree_02
  - `dead-trunk.glb` — Dead Tree Trunk — https://polyhaven.com/a/dead_tree_trunk
  - `barrels.glb` — Wooden Barrels 01 — https://polyhaven.com/a/wooden_barrels_01
  - `crate.glb` — Wooden Crate 02 — https://polyhaven.com/a/wooden_crate_02
  - `oil-lamp.glb` — Vintage Oil Lamp — https://polyhaven.com/a/vintage_oil_lamp
  - `fire-pit.glb` — Stone Fire Pit — https://polyhaven.com/a/stone_fire_pit

## Texturas

- Chão e rocha (albedo, normal, rugosidade) — Poly Haven, CC0:
  - Dry Ground 01 — https://polyhaven.com/a/dry_ground_01
  - Rocks Ground 08 — https://polyhaven.com/a/rocks_ground_08

Construções, carroções, barracas, cactos, mesas, capim, pessoas, chapéus e arreios são
modelados por código em `src/props.js`, `src/terrain.js` e `src/actors.js`, com as
texturas procedurais de `labs/shared/gfx`.
