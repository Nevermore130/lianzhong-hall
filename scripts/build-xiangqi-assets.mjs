import { mkdirSync, writeFileSync } from "node:fs";
const root = new URL("../public/assets/xiangqi-v1/", import.meta.url);
mkdirSync(new URL("pieces/", root), { recursive: true });
const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 600">';
let lines = "";
for (let y = 0; y < 10; y++) lines += `<path d="M54 ${57 + y * 54}H486"/>`;
for (let x = 0; x < 9; x++) {
  const a = 54 + x * 54;
  lines +=
    x === 0 || x === 8
      ? `<path d="M${a} 57V543"/>`
      : `<path d="M${a} 57V273M${a} 327V543"/>`;
}
lines +=
  '<path d="m216 57 108 108m0-108-108 108m0 270 108 108m0-108-108 108"/>';
for (const [x, y] of [
  [1, 2],
  [7, 2],
  [1, 7],
  [7, 7],
  ...[0, 2, 4, 6, 8].flatMap((x) => [
    [x, 3],
    [x, 6],
  ]),
]) {
  for (const dx of [-1, 1])
    for (const dy of [-1, 1]) {
      if ((x === 0 && dx === -1) || (x === 8 && dx === 1)) continue;
      lines += `<path d="M${54 + x * 54 + dx * 12} ${57 + y * 54 + dy * 5}h${-dx * 7}v${dy * 7}"/>`;
    }
}
const grid = `${head}<g fill="none" stroke="#614221" stroke-width="1.65" stroke-linecap="square">${lines}<rect x="48" y="51" width="444" height="498" stroke-width="2.8"/></g><g fill="#674321" font-family="KaiTi,STKaiti,Kaiti SC,serif" font-size="30" text-anchor="middle"><text x="162" y="311" letter-spacing="10">楚河</text><text x="378" y="311" letter-spacing="10">漢界</text></g></svg>`;
writeFileSync(new URL("board-grid.svg", root), grid);
const names = {
  king: ["帥", "將"],
  advisor: ["仕", "士"],
  elephant: ["相", "象"],
  horse: ["馬", "馬"],
  rook: ["車", "車"],
  cannon: ["炮", "砲"],
  pawn: ["兵", "卒"],
};
const pieces = [];
for (const [kind, glyphs] of Object.entries(names))
  for (let side = 1; side <= 2; side++) {
    const file = `pieces/${side}-${kind}.svg`,
      ink = side === 1 ? "#922b20" : "#2d2a22";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>${side === 1 ? "红方" : "黑方"}${glyphs[side - 1]}</title><circle cx="50" cy="49" r="34" fill="none" stroke="${ink}" stroke-width="1.2" opacity=".7"/><text x="50" y="65" text-anchor="middle" font-size="47" font-weight="bold" font-family="KaiTi,STKaiti,Kaiti SC,serif" fill="${ink}" stroke="${ink}" stroke-width=".35">${glyphs[side - 1]}</text></svg>`;
    writeFileSync(new URL(file, root), svg);
    pieces.push({ side, kind, glyph: glyphs[side - 1], file });
  }
const markup = (p) =>
  `<span class="piece"><img src="piece-wood.webp" alt=""><img src="${p.file}" alt="${p.side === 1 ? "红方" : "黑方"}${p.glyph}"></span>`;
writeFileSync(
  new URL("preview.html", root),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>中国象棋 · 复古素材</title><style>*{box-sizing:border-box}body{margin:0;background:#4a5f7f;color:#fff3d4;font:14px serif}main{max-width:1040px;margin:auto;padding:24px}h1{font-size:24px;font-weight:normal}a{color:#ffe7a1}.layout{display:grid;grid-template-columns:minmax(0,540px) 1fr;gap:30px}.board{width:100%;aspect-ratio:9/10;background:url(board-wood.webp) center/100% 100%;position:relative}.board>img{width:100%;height:100%}.piece{display:inline-block;width:84px;height:84px;position:relative;flex-shrink:0}.piece img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.pieces{display:flex;flex-wrap:wrap;gap:4px}.small .piece{width:36px;height:36px}@media(max-width:700px){.layout{grid-template-columns:1fr}}</style><main><h1>中国象棋 · 旧木棋盘与红黑木棋子</h1><p><a href="/">返回游戏大厅</a>　顶视角 / 独立木纹与字层 / 等比圆形棋子</p><div class="layout"><div class="board"><img src="board-grid.svg" alt="九路十横的中国象棋棋盘"></div><div><h2>红方</h2><div class="pieces">${pieces
    .filter((p) => p.side === 1)
    .map(markup)
    .join("")}</div><h2>黑方</h2><div class="pieces">${pieces
    .filter((p) => p.side === 2)
    .map(markup)
    .join(
      "",
    )}</div><h2>小尺寸</h2><div class="pieces small">${pieces.map(markup).join("")}</div></div></div></main></html>`,
);
writeFileSync(
  new URL("manifest.json", root),
  JSON.stringify(
    {
      version: 1,
      viewBox: [0, 0, 540, 600],
      grid: { origin: [54, 57], step: 54, files: 9, ranks: 10 },
      textures: ["board-wood.webp", "piece-wood.webp"],
      gridLayer: "board-grid.svg",
      pieces,
      preview: "preview.html",
      source: "assets/source/xiangqi-v1/PROMPTS.md",
      rebuild: "node scripts/build-xiangqi-assets.mjs",
    },
    null,
    2,
  ) + "\n",
);
