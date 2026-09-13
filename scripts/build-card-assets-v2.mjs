import { mkdirSync, writeFileSync } from "node:fs";

// Exact indices/pips remain vector artwork. Paper and printed character layers
// are shared bitmap assets, so a hand does not download the same texture 20 times.
const root = new URL("../public/assets/playing-cards-v2/", import.meta.url);
const folder = new URL("cards/", root);
mkdirSync(folder, { recursive: true });
const suits = ["黑桃", "红桃", "梅花", "方块"];
const paths = [
  "M0-10C-3-6-9-3-9 2C-9 7-3 8 0 4C0 7-1 9-4 10H4C1 9 0 7 0 4C3 8 9 7 9 2C9-3 3-6 0-10Z",
  "M0 9C-3 5-9 1-9-4C-9-10-2-11 0-6C2-11 9-10 9-4C9 1 3 5 0 9Z",
  "M0-10C-6-10-7-4-3-2C-10-5-12 3-7 6C-4 8-1 6 0 4C0 7-1 9-4 10H4C1 9 0 7 0 4C1 6 4 8 7 6C12 3 10-5 3-2C7-4 6-10 0-10Z",
  "M0-11L8 0 0 11-8 0Z",
];
const pairRows = (rows) =>
  rows.flatMap((y) => [
    [27, y],
    [53, y],
  ]);
const layout = {
  1: [[40, 58]],
  2: [
    [40, 27],
    [40, 89],
  ],
  3: [
    [40, 27],
    [40, 58],
    [40, 89],
  ],
  4: pairRows([27, 89]),
  5: [...pairRows([27, 89]), [40, 58]],
  6: pairRows([27, 58, 89]),
  7: [...pairRows([27, 58, 89]), [40, 42.5]],
  8: [...pairRows([27, 58, 89]), [40, 42.5], [40, 73.5]],
  9: [...pairRows([27, 47.7, 68.3, 89]), [40, 58]],
  10: [...pairRows([27, 47.7, 68.3, 89]), [40, 37.3], [40, 78.7]],
};
function pip(suit, x, y, scale = 0.72, rotate = y > 58) {
  return `<path d="${paths[suit]}" transform="translate(${x} ${y}) rotate(${rotate ? 180 : 0}) scale(${scale})"/>`;
}
const labels = [];
for (let card = 0; card < 54; card++) {
  const joker = card >= 52;
  const rank = Math.floor(card / 4) + 3;
  const label =
    { 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2" }[rank] ?? String(rank);
  const suit = card % 4;
  const red = joker ? card === 53 : suit === 1 || suit === 3;
  const ink = red ? "#9c2829" : "#282724";
  const name = joker ? (card === 53 ? "大王" : "小王") : suits[suit] + label;
  const corners = joker
    ? [..."JOKER"]
        .map(
          (letter, i) =>
            `<text x="6.5" y="${14 + i * 9.6}" font-size="9.5">${letter}</text>`,
        )
        .join("") +
      '<path d="M6.5 62l1.3 3.5 3.7.2-2.9 2.3 1 3.5-3.1-2.1-3.1 2.1 1-3.5-2.9-2.3 3.7-.2Z"/>'
    : `<text x="7" y="18" font-size="17" ${label === "10" ? 'textLength="12" lengthAdjust="spacingAndGlyphs"' : ""}>${label}</text>${pip(suit, 7, 28, 0.42, false)}`;
  let center = "";
  if (!joker && rank >= 11 && rank <= 13) {
    center =
      '<rect x="13" y="17" width="54" height="82" rx=".4" fill="none" stroke="currentColor" stroke-width=".55"/><path d="M14 18h52v80H14Z" fill="none" stroke="currentColor" stroke-width=".2"/>';
  } else if (!joker) {
    const count = rank === 14 ? 1 : rank === 15 ? 2 : rank;
    center = layout[count]
      .map(([x, y]) => pip(suit, x, y, count === 1 ? 1.5 : 0.72))
      .join("");
    if (count === 1 && suit === 0) {
      center +=
        '<path d="M40 48c-4 4-8 6-8 11 0 3 4 4 8 0 4 4 8 3 8 0 0-5-4-7-8-11Z" fill="none" stroke="#eee3cc" stroke-width=".55"/><path d="M35 58q5-7 10 0M36 61q4-5 8 0" fill="none" stroke="#eee3cc" stroke-width=".5"/>';
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 116"><title>${name}</title><g fill="${ink}" color="${ink}" font-family="Georgia,Times New Roman,serif" font-weight="bold" text-anchor="middle">${center}${corners}<g transform="translate(80 116) rotate(180)">${corners}</g></g></svg>\n`;
  writeFileSync(new URL(`${card}.svg`, folder), svg);
  labels.push(name);
}

// A static contact sheet exercises the same layers without changing a real deal.
const artFor = (id) =>
  id >= 52
    ? id === 53
      ? "joker-red"
      : "joker-black"
    : { 11: "court-jack", 12: "court-queen", 13: "court-king" }[
        Math.floor(id / 4) + 3
      ];
const cardMarkup = (id) =>
  `<span class="playing-card" role="img" aria-label="${labels[id]}">${artFor(id) ? `<img class="playing-card-art ${id >= 52 ? "joker-art" : "court-art"} ${artFor(id)}" src="${artFor(id)}.webp" alt="">` : ""}<img class="playing-card-indices" src="cards/${id}.svg" alt=""></span>`;
const preview = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>复古扑克牌 · 素材预览</title><link rel="stylesheet" href="card.css"><style>*{box-sizing:border-box}body{margin:0;background:#21483e;color:#f0e4c8;font:14px Georgia,serif}main{max-width:1100px;margin:auto;padding:32px 24px}h1{font-size:23px;font-weight:normal;margin:0 0 10px}p{color:#c1c5ab;line-height:1.6}a{color:#e1c78f}.featured,.deck{display:flex;flex-wrap:wrap;gap:24px;margin:28px 0}figure{margin:0}figcaption{font-size:12px;text-align:center;margin-top:10px}.featured{--card-width:160px}.deck{--card-width:80px;gap:20px}.hand{display:flex;--card-width:62px;max-width:700px;margin:28px 0}.hand>.playing-card{flex-shrink:0;margin-right:-34px}.playing-card{box-shadow:1px 3px 5px #001b19aa}h2{font-size:17px;font-weight:normal;margin-top:40px}@media(max-width:600px){main{padding:20px 16px}.featured{--card-width:140px;gap:20px}.deck{--card-width:66px;gap:16px}.hand{--card-width:46px}.hand>.playing-card{margin-right:calc((100vw - 78px)/19 - 46px)}} </style><main><h1>复古扑克牌 · 第二版</h1><p>米白旧纸 / 红黑套印 / 传统双头人物与全身弄臣<br><a href="/">返回游戏大厅</a></p><div class="featured">${[53, 52, 40, 37, 32].map((id) => `<figure>${cardMarkup(id)}<figcaption>${labels[id]}</figcaption></figure>`).join("")}<figure><span class="playing-card playing-card-back"><img src="card-back.webp" alt="牌背"></span><figcaption>牌背</figcaption></figure></div><h2>实际手牌大小 · 20 张</h2><div class="hand">${[53, 52, 49, 44, 40, 37, 32, 28, 29, 24, 25, 20, 21, 16, 17, 12, 8, 4, 1, 0].map(cardMarkup).join("")}</div><h2>完整牌面 · 54 张</h2><div class="deck">${labels.map((label, id) => `<figure>${cardMarkup(id)}<figcaption>${label}</figcaption></figure>`).join("")}</div></main></html>`;
writeFileSync(new URL("preview.html", root), preview);
writeFileSync(
  new URL("manifest.json", root),
  JSON.stringify(
    {
      version: 2,
      viewBox: [0, 0, 80, 116],
      faces: {
        path: "cards/{id}.svg",
        count: 54,
        type: "transparent exact index/pip layer",
      },
      shared: [
        "paper.webp",
        "card-back.webp",
        "joker-red.webp",
        "joker-black.webp",
        "court-jack.webp",
        "court-queen.webp",
        "court-king.webp",
      ],
      stylesheet: "card.css",
      preview: "preview.html",
      source: "assets/source/playing-cards-v2",
      rebuild: "node scripts/build-card-assets-v2.mjs",
    },
    null,
    2,
  ) + "\n",
);
