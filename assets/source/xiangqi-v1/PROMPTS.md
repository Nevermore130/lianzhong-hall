# 中国象棋素材 v1

使用内置 imagegen 生成两张 PNG 母版；用 cwebp 缩放和转换为页面 WebP。棋盘网格、楚河汉界、棋子字样及交互标记由 SVG 精确绘制，所有图层共用顶视角。

## board-wood

```text
Use case: photorealistic-natural. Asset type: reusable blank Chinese chess (xiangqi) wooden board surface for a retro 1998 desktop game. Exact orthographic top-down flat scan, portrait aspect ratio 9:10. Entire canvas filled edge to edge by an old honey-colored boxwood board with gentle vertical wood grain, fine pores, hand-polished satin finish, tiny usage scratches, restrained warm patina. The central 90 percent is smooth light golden tan with even diffuse lighting so dark grid lines will be clearly legible. Very narrow darker aged wood edging within the outermost 3 percent, no perspective or bevel distortion. Beautiful tactile Chinese park chess-set material, quietly aged, no decorative dragons. Absolutely BLANK: no grid, no lines, no squares, no Chinese characters, no chess pieces, no symbols, no labels, no letters, no watermark, no surrounding desk, no cast shadow. We will overlay a mathematically exact 9-file 10-rank board and river in code. Production game texture, NOT a photograph of a scene.
```

## piece-wood

```text
Use case: product-mockup. Asset type: ONE blank wooden Chinese chess xiangqi disc sprite, genuine transparent alpha background. Exact orthographic TOP-DOWN view, perfectly circular face, no perspective and no elliptical distortion, centered on a square canvas. A traditional thick pale boxwood chess piece, softly rounded turned rim with one shallow concentric engraved groove at radius 85 percent of the face, honey-beige wood, extremely subtle natural fine grain, mellow 1980s hand-polished satin varnish, tiny edge rubs and a few hairline scratches. Face is FLAT and EMPTY, warm light cream so later red and black Chinese characters read clearly. Gentle upper-left diffuse lighting makes a shallow circular bevel and narrow lower rim visible while the face stays truly round. Disc including its faint immediate shadow fits inside a circle of diameter 92 percent of canvas, equal transparent margins on all sides. No backdrop, no square tile, no baked checkerboard, no paper ground, NO text, NO letters, NO characters, NO symbols, NO colored rings, NO other objects. A realistic small wooden game counter, not a cylinder viewed from an angle. Transparent everywhere outside this single disc.
```

运行文件位于 `public/assets/xiangqi-v1/`。棋子保持正方形画布和等比缩放；红黑两方复用同一个透明木棋子底层，SVG 字层保持文字清晰。重建字层、网格、清单与预览：`node scripts/build-xiangqi-assets.mjs`。
