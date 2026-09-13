# 复古扑克牌素材 v2

使用内置 imagegen 生成和编辑，共七张最终 PNG 母版，全部保存在本目录；运行资源位于 `public/assets/playing-cards-v2/`。未使用 API/CLI 图像生成。

## 视觉与图层

- 参考 [World of Playing Cards 的 Hong Kong Joker 图集](https://www.wopc.co.uk/playing-cards/the-joker-card/) 的全身弄臣和旧式套印语言；人物为新生成的原创插画，没有品牌或产地声明。
- 大王：红、蓝、赭黄色的全身弄臣；小王：黑色线刻弄臣。两者采用相同题材和印刷风格，以颜色和图案区分。
- J/Q/K：羽帽侍从、持花皇后、持剑国王，传统双头人物；四种花色共用对应等级插画，以独立角标区分。
- 纸面：暖米白纸、细压纹、边缘泛黄与少量磨损；牌背沿用第一版酒红雕花图案并做旧。
- `paper.webp` 是共用底层；`joker-*.webp` 和 `court-*.webp` 保留透明通道；`cards/0.svg` 至 `53.svg` 仅绘制精确角标、花色和框线。
- `card.css` 在页面合成完整牌面。SVG 角标层本身不是完整的带底图扑克牌。预览页展示大图、20 张手牌尺寸和完整 54 张牌。
- 牌 ID 沿用原协议：0–51 按 3 至 A、2 每点数四张，依次黑桃/红桃/梅花/方块；52 小王，53 大王。

## 重建

`node scripts/build-card-assets-v2.mjs` 重建角标/花色 SVG、manifest 与预览页。WebP 使用 cwebp 仅缩放和格式转换，宽 480px，纸纹质量 84，人物和牌背质量 92。原图保持不变。

牌背编辑输入是 `../doudizhu-v1/card-back.png`；其余为独立生成。早期未正确生成透明背景的小王试稿未用于页面，最终选用下列独立生成版本。旧版整副牌保留，便于回退。

## 显示比例

人物 WebP 均为 480×720。`card.css` 使用宽度配合 `height: auto`，保持 2:3 原始比例；不要同时指定不成比例的宽高。J/Q/K 在 80×116 牌面中占 52×78，外框为 54×82，角标留在两侧。

大小王按 alpha > 50% 的可见图案包围盒对齐：大王为 `(63, 2, 403, 702)`，小王为 `(70, 23, 388, 665)`，字段依次是 x、y、宽、高。两者可见高度归一为牌面坐标中的 96，并将可见区域中心对齐牌面中心。CSS 中各自的宽度与平移补偿源文件的透明留白；更换原图时需要重新测量，不能仅按画布居中。游戏组件与预览页都添加对应的 `joker-red` / `joker-black` 类。

## 最终提示词

### paper

```text
Use case: photorealistic-natural. Asset type: full-bleed playing-card paper texture for game UI, portrait aspect ratio 80:116. Flatbed macro scan of a BLANK gently used vintage playing card's ivory paper surface. Entire rectangular canvas filled edge to edge with paper. Warm cream center, restrained tea-yellow oxidation only around outermost 3 percent of edges, tiny mottled foxing near corners, softened compressed fibers, subtle linen-embossed crosshatch and minute scratches in old semi-matte varnish. Authentic lightly used 1980s plastic-coated card stock, cream rather than dark brown parchment. Slight rub wear, fine realistic tactile grain visible close-up but calm at thumbnail size. Uniform diffuse scan illumination, exact orthographic. No card outline, no rounded canvas corners, no shadow, no outside background, NO crease across center, NO text, NO illustrations, no numbers, no symbols, no ornate border. Keep the center clean enough for readable red and black printing.
```

### joker-red

```text
Use case: stylized-concept. Asset type: original central RED JOKER illustration, transparent layered game-card asset. Re-create the convincing visual language of a genuine vintage Hong Kong printed playing-card joker from the 1960s–1980s: a lively full-body adult court jester in an elegant dancing pose, human proportions and expressive engraved face, three-point belled cap, ruffled collar, richly patterned harlequin costume, stockings and curled shoes. He is juggling three small playing cards above his outstretched hands. Printmaker's finely drawn black contours and crosshatching, aged flat vermilion red, Prussian blue and mustard yellow ink, slight offset-print misregistration and pinprick ink wear. Charming antique commercial lithograph, intricate clothing detail, not a vector icon, not a child's cartoon, not a real person photograph. One upright full figure only, NO mirrored duplicate. Both hands and both feet fully visible, no extra limbs. Centered figure occupies 88% canvas height and 85% width. Portrait aspect 2:3. GENUINE transparent alpha background, empty between arms and legs. No paper ground, no card frame, no shadows, NO letters, NO text, NO brand, no title banner. The game will add exact JOKER indices separately.
```

### court-jack

```text
Use case: stylized-concept. Asset type: transparent central court-card illustration for a real-looking vintage poker deck in a Chinese Windows98 game. Traditional Anglo-American double-headed court playing-card print, as mass-produced in Hong Kong in the 1960s–1980s. Detailed black woodcut/engraved outlines and small flat areas of faded vermilion, ochre yellow and Prussian blue, tiny ink gaps and subtly imperfect offset-print registration. Natural engraved human facial anatomy, intricate crosshatching, ornamental patterned robes, bold readable silhouettes at small size. NOT geometric vector clipart, NOT modern cartoon, NOT photorealistic live actor. A single narrow upright rectangular composition, full 180-degree two-way rotational symmetry with the upright half-figure repeated upside-down at the waist. BOTH heads visible. Genuine transparent alpha background, including outside the figure, no card stock, no outer playing card, no card corners, NO letters, NO numerals, NO suit symbols, NO brand. Figure occupies nearly all canvas with 3% transparent margin. Output portrait aspect 2:3. Subject: JACK, clean-shaven young medieval royal attendant shown in three-quarter profile, a soft feathered cap instead of a crown, holding a halberd, richly striped and diamond-patterned tunic. Focus on authentic engraved eyes, nose, curls, feather and interlacing textile ornament. Ochre and Prussian-blue dominant with small red accents.
```

### court-queen

```text
Use case: stylized-concept. Asset type: transparent central court-card illustration for a real-looking vintage poker deck in a Chinese Windows98 game. Traditional Anglo-American double-headed court playing-card print, as mass-produced in Hong Kong in the 1960s–1980s. Detailed black woodcut/engraved outlines and small flat areas of faded vermilion, ochre yellow and Prussian blue, tiny ink gaps and subtly imperfect offset-print registration. Natural engraved human facial anatomy, intricate crosshatching, ornamental patterned robes, bold readable silhouettes at small size. NOT geometric vector clipart, NOT modern cartoon, NOT photorealistic live actor. A single narrow upright rectangular composition, full 180-degree two-way rotational symmetry with the upright half-figure repeated upside-down at the waist. BOTH heads visible. Genuine transparent alpha background, including outside the figure, no card stock, no outer playing card, no card corners, NO letters, NO numerals, NO suit symbols, NO brand. Figure occupies nearly all canvas with 3% transparent margin. Output portrait aspect 2:3. Subject: QUEEN, regal mature woman in three-quarter view with delicate engraved facial features, long waved hair and a jeweled gold crown, holding one flower, wearing an ornate red, ochre and Prussian-blue patterned court dress. Fine details of leaves, petals, crown and embroidered fabric, unmistakable queen.
```

### court-king

```text
Use case: stylized-concept. Asset type: transparent central court-card illustration for a real-looking vintage poker deck in a Chinese Windows98 game. Traditional Anglo-American double-headed court playing-card print, as mass-produced in Hong Kong in the 1960s–1980s. Detailed black woodcut/engraved outlines and small flat areas of faded vermilion, ochre yellow and Prussian blue, tiny ink gaps and subtly imperfect offset-print registration. Natural engraved human facial anatomy, intricate crosshatching, ornamental patterned robes, bold readable silhouettes at small size. NOT geometric vector clipart, NOT modern cartoon, NOT photorealistic live actor. A single narrow upright rectangular composition, full 180-degree two-way rotational symmetry with the upright half-figure repeated upside-down at the waist. BOTH heads visible. Genuine transparent alpha background, including outside the figure, no card stock, no outer playing card, no card corners, NO letters, NO numerals, NO suit symbols, NO brand. Figure occupies nearly all canvas with 3% transparent margin. Output portrait aspect 2:3. Subject: KING, dignified mature bearded monarch in three-quarter view, detailed mustache and curled beard, wearing a tall gold crown, holding a vertical ceremonial sword, richly embroidered red, ochre and Prussian-blue robe. Fine details of beard, fingers, crown jewels and geometric textile patterns, unmistakable king.
```

### joker-black

```text
Use case: stylized-concept. Asset type: transparent black-joker illustration for a vintage playing card, delivered as a PNG with a transparent background. One full-body adult European court jester dancing and juggling three tiny playing cards, wearing a three-point belled cap, large ruffled collar, patterned harlequin costume, belled cuffs, stockings and curled shoes. Natural adult human proportions, detailed engraved smiling face, torso facing viewer with face slightly turned to the right; one knee lifted on the left and the other leg extended down on the right. Arms open, both hands and both feet fully visible. Convincing 1970s Hong Kong mass-produced poker card print: charcoal BLACK INK ONLY, cream highlights inside the figure, intricate pen-and-ink crosshatching, small irregular ink gaps, traditional commercial lithograph rather than modern cartoon or vector clipart. Absolutely monochrome, no red or blue ink. The printed figure and three small juggling cards are clean isolated opaque cutouts on an entirely transparent canvas; empty gaps between arms and legs must also be transparent. No backdrop, no paper sheet, no card frame, no shadows, no glow, no writing, no letters, no banner. One upright full figure only. Portrait 2:3, figure fills 88% height with room around all outer details.
```

### card-back

```text
Use case: precise-object-edit. Edit target: attached burgundy playing-card back. Preserve its complete symmetrical engraved filigree, repeating diamonds, central rosette, burgundy and ivory palette and upright flat full-bleed rectangular layout. Make it look like a genuine gently handled vintage plastic-coated Hong Kong poker card. Add a narrow warm ivory paper margin along the outermost 3% on each side; softly rubbed burgundy ink immediately inside the margins; microscopic ink dropout, fine paper grain, tiny softened edge scuffs, restrained yellowing at outer corners. Keep the print clean and detailed in the middle, not stained or ruined. Flatbed scan illumination, 180-degree two-way symmetry, no perspective, no drop shadow, no external background, no rounded external canvas, no text, no brand. Portrait aspect ratio 80:116.
```
