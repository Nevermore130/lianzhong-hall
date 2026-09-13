# 斗地主素材 v1

使用内置 imagegen 分别生成三个位图资产。PNG 原图保留在此目录，页面使用 `public/assets/doudizhu-v1/` 下的 WebP（cwebp 仅缩放/格式转换，牌桌保留 alpha）。

- felt.webp：768×768 绿绒纹理，质量 82。
- card-back.webp：240×360 酒红雕花牌背，质量 90。
- lobby-table.webp：512×512 大厅圆牌桌，质量 88。
- cards/0.svg 至 53.svg：54 张牌面，由 `scripts/build-card-assets.mjs` 精确绘制数字、花色和 J/Q/K 肖像；运行 `node scripts/build-card-assets.mjs` 可重建。牌 ID 0–51 按 3 到 2 每点数四张排列（黑桃、红桃、梅花、方块），52/53 为小王/大王。
- landlord.svg：同一脚本绘制的地主帽徽章。

人物沿用大厅已有头像，仅实际入座时展示；不渲染虚构在线玩家。

## 最终提示词

### felt

```text
Production full-bleed texture asset for a 1998 Chinese multiplayer card game. Square canvas entirely covered by deep emerald green felt billiard/card-table cloth. Perfectly top-down orthographic, flat plane, even soft upper-left lighting, subtle woven fibers, softly worn short felt pile, restrained tonal dithering like a pre-rendered late-1990s PC game, deep moss emerald green, calm low contrast so white playing cards stand out. No objects, NO cards, no wood rim, no borders, no logos, no writing, no geometric markings, no stains, no large creases, no dark vignette. Original game texture, seamless-looking full bleed.
```

### card-back

```text
Production playing-card BACK artwork, original late-1990s Chinese PC card game aesthetic. One flat vertical rectangular design with 2:3 width to height aspect, fills entire image edge to edge. Deep oxblood burgundy ground, ivory and aged-gold engraved fine lines forming elegant symmetrical lattice and small repeating diamond motifs, double thin ivory rectangular border inset from edge, central small eight-point rosette. Exact 180-degree rotational symmetry, restrained 16-bit painted print texture, crisp low-detail design legible at 40 pixels wide. Top-down flat graphic, no perspective, no shadow, no background outside design, no rounded external canvas, NO letters, NO text, NO numbers, NO logo, no real-world brand. One artwork only, no mockup or duplicate cards.
```

### lobby-table

```text
Use case stylized-concept. Production transparent 2D sprite for a 1998 Chinese three-player Dou Dizhu card-game lobby. Generate ONLY one empty ROUND games table, no chairs, no people, no playing cards. Small pre-rendered 3D PC game artwork with painted 16-bit highlights, honey-brown polished wood rim, deep emerald green felt inset, three dark brown wooden legs visible, original furniture. Orthographic isometric camera elevated 30 degrees above ground, top reads as wide ellipse, realistic modest proportions, soft upper-left lighting. Full table centered, all legs visible, square canvas, table occupies 82% canvas width and 70% height with ample transparent margin. Genuine transparent alpha background, no checkerboard baked in, no floor, no cast ground shadow, no writing, no text, no logo. Crisp antialiased silhouette, not vector, not modern cartoon.
```
