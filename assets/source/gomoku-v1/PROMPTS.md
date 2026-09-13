# 五子棋素材 v1

生成方式：内置 imagegen。俯视木纹棋盘与黑白棋子分别生成，原始 PNG 保存在本目录；未采用的生成尝试未加入项目。

页面资源位于 `public/assets/gomoku-v1/`：木纹缩至 880×880、WebP quality 86；棋子缩至 128×128 后无损 WebP 编码，保留 alpha。仅使用 cwebp 做尺寸和格式转换。棋子组件使用居中的圆形显示区域（素材中心 84%），统一两种棋子的实际直径，并隔离原始生成边缘的细小杂色；源图保持原样。

棋盘格线由 Board.tsx 的 SVG 生成，15×15 交点与按钮中心严格对齐。四边坐标由 HTML 布局，末手四角红标记为手写 `last-move.svg`，不烘焙在纹理中。

## 最终采用提示词

### board-wood

```text
Use case: texture, production background asset for a 1998 Chinese PC Gomoku game. Generate one square FULL BLEED warm honey-gold katsura wood board surface, perfectly top-down orthographic, absolutely flat plane with NO perspective. Entire canvas is wood, right up to all four edges. Fine mostly vertical natural wood grain, restrained warm amber and pale golden colors, low contrast across the playable area, softly worn satin finish with tiny subtle pores, authentic pre-rendered late-1990s PC game material with delicate painted grain and subtle tonal dithering. Calm, readable surface designed to carry a thin dark 15x15 grid drawn separately in code. Gentle even illumination from upper left. No grid, no lines, no border or frame, no chess pieces, no symbols, no letters or numbers, no logos, no watermark, no knots, no dark stains, no cracks, no scratches that resemble grid lines. Square 1024px texture. Original game asset.
```

### stone-black

```text
Use case: production transparent game sprite for a retro 1998 Chinese PC Gomoku board. Exactly ONE BLACK GO STONE centered on a genuine transparent alpha background, square 1024px canvas. Perfectly top-down orthographic camera, circular silhouette, round biconvex polished black slate game stone, restrained broad soft highlight in upper-left, charcoal subtly blue-grey highlights fading to near-black at lower right, subtle mineral pores and delicate 16-bit style painted shading, satin polished finish. Realistic low dome, NOT a spherical ball, NOT vector art, NOT glossy plastic, no thick outline. Stone diameter exactly 88 percent of canvas width with equal transparent margins. Circle perfectly centered at 50% x 50%; no perspective ellipse. No floor, NO cast shadow outside the silhouette (shadow will be added in code), no scenery, no checkerboard pattern baked in, no board, no text, no markings, no white border. Crisp antialiased edge, ready to layer on a honey-colored wooden board. Original pre-rendered game artwork.
```

### stone-white

```text
Use case: production transparent game sprite for a retro 1998 Chinese PC Gomoku board. Exactly ONE IVORY-WHITE GO STONE centered on a genuine transparent alpha background, square 1024px canvas. Perfectly top-down orthographic camera, circular silhouette, round biconvex polished ivory-white porcelain game stone, restrained broad soft highlight in upper-left, warm off-white body fading to a soft warm grey at lower right, subtle ceramic pores and delicate 16-bit style painted shading, satin polished finish. Realistic low dome, NOT a spherical ball, NOT vector art, NOT glossy plastic, no thick outline. Stone diameter exactly 88 percent of canvas width with equal transparent margins. Circle perfectly centered at 50% x 50%; no perspective ellipse. No floor, NO cast shadow outside the silhouette (shadow will be added in code), no scenery, no checkerboard pattern baked in, no board, no text, no markings, no black border. Crisp antialiased edge, ready to layer on a honey-colored wooden board. Original pre-rendered game artwork.
```
