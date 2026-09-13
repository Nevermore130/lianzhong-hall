# 大厅分层素材 v1 · 生成记录

生成方式：内置 imagegen 工具。每个素材单独生成；以下为实际采用版本的完整提示词。

源 PNG 位于 `assets/source/lobby-v1/`，页面使用的无损 WebP 位于 `public/assets/lobby-v1/`。保留原始透明通道，WebP 仅做无损格式转换。

## table

```text
Use case: stylized-concept. Asset type: production transparent 2D sprite for a late-1990s Chinese multiplayer board-game lobby. Generate ONLY one empty square games table, no chairs and no people.
Style: small pre-rendered 3D game sprite with carefully painted low-color highlights, like a 1998 PC game, realistic proportions, modest detail, softly dithered wood and fabric, crisp silhouette. NOT vector art, not modern cartoon, no thick black outlines. Materials: honey-brown wood rim and four dark wood tapered legs, deep emerald-green felt inset, a thin tan wooden 15x15 Gomoku board centered on the felt. Board is EMPTY, no pieces. No writing or labels anywhere.
Camera: orthographic isometric view, elevated 30 degrees above the ground, two equal visible side faces; back corner straight up, front corner straight down, left-right corners horizontal. Soft light from upper left. Transparent background with real alpha, no checkerboard pattern baked in, no floor, no scenery, no ground shadow.
Composition: single full table centered in a square 1024x1024 canvas with at least 100px transparent margin on all sides, every leg fully visible. The table silhouette should occupy approximately 75% canvas width and 65% canvas height. The image must be ready to layer with separately generated chairs and seated players in a game UI. Original game artwork, no logos, no watermark.
```

## chair-far

```text
Use case: stylized-concept. Create a transparent PNG game sprite of ONLY ONE EMPTY CHAIR on genuine alpha transparency. A modest 1998 Chinese board-game lobby chair: ivory cream upholstered rectangular backrest and square padded seat, honey-brown wood frame, dark brown straight legs, NO arms. Orthographic isometric camera elevated 30 degrees with equal-axis projection. Small pre-rendered 3D PC game artwork, realistic furniture proportions, painted restrained wood grain, soft upper-left lighting. Full chair including feet, centered on square canvas with ample empty transparent margins, chair fills 75% height. No table, no human, no environment, no floor, no shadow, no letters. The chair faces toward bottom-left of the image: the backrest is upper-right behind the seat and the camera sees its FRONT upholstery. Front three-quarter view.
```

## chair-near

```text
Use case: stylized-concept. Create a transparent PNG game sprite of ONLY ONE EMPTY CHAIR on genuine alpha transparency. A modest 1998 Chinese board-game lobby chair: ivory cream upholstered rectangular backrest and square padded seat, honey-brown wood frame, dark brown straight legs, NO arms. Orthographic isometric camera elevated 30 degrees with equal-axis projection. Small pre-rendered 3D PC game artwork, realistic furniture proportions, painted restrained wood grain, soft upper-left lighting. Full chair including feet, centered on square canvas with ample empty transparent margins, chair fills 75% height. No table, no human, no environment, no floor, no shadow, no letters. The chair faces toward upper-right of the image: backrest is at the bottom-left in front of the seat, and the camera sees the BACK of the backrest. Rear three-quarter view.
```

## player-far

```text
Use case: stylized-concept. Generate a production TRANSPARENT game character sprite. One ordinary adult East Asian woman, short dark hair, muted dusty-rose cardigan over ivory top, charcoal trousers, simple black shoes. FULL BODY seated posture on an INVISIBLE chair, knees bent 90 degrees, feet down, arms naturally extended forward as if resting hands on an INVISIBLE game table. No actual table, no actual chair, no props. She faces diagonally LOWER LEFT, seen from FRONT three-quarter view. Orthographic isometric camera 30 degrees above ground, same equal-axis 2:1 game-sprite projection used in 1998 Chinese board-game clients. Realistic adult proportions, compact pre-rendered 3D sprite with painted 16-bit-style shading, modest clothing detail, soft light from upper left. No chibi, no outline, no modern glossy cartoon. Full character centered with transparent margins in square canvas, body including feet occupies about 80% height. Plain genuine transparent alpha background. No floor, no cast ground shadow, no text, no logo.
```

## player-near

```text
Use case: stylized-concept. Generate a production TRANSPARENT game character sprite. One ordinary adult East Asian man, short neatly cut dark hair, muted blue long-sleeve shirt with ivory collar, charcoal trousers, simple black shoes. FULL BODY seated posture on an INVISIBLE chair, knees bent 90 degrees, feet down, arms naturally extended forward as if resting hands on an INVISIBLE game table. No actual table, no actual chair, no props. He faces diagonally UPPER RIGHT, seen from BEHIND in rear three-quarter view: the back of his head, back and right side are visible, not his front face. Orthographic isometric camera 30 degrees above ground, same equal-axis 2:1 game-sprite projection used in 1998 Chinese board-game clients. Realistic adult proportions, compact pre-rendered 3D sprite with painted 16-bit-style shading, modest clothing detail, soft light from upper left. No chibi, no outline, no modern glossy cartoon. Full character centered with transparent margins in square canvas, body including feet occupies about 80% height. Plain genuine transparent alpha background. No floor, no cast ground shadow, no text, no logo.
```
