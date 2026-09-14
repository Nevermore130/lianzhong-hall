import { mkdir, writeFile } from "node:fs/promises";
const out = new URL("../public/assets/mahjong-v1/glyphs/", import.meta.url);
await mkdir(out, { recursive: true });
const red = "#9c2828",
  green = "#23604b",
  blue = "#233e5b";
const positions = {
  1: [[50, 70]],
  2: [
    [50, 40],
    [50, 100],
  ],
  3: [
    [28, 35],
    [50, 70],
    [72, 105],
  ],
  4: [
    [28, 40],
    [72, 40],
    [28, 100],
    [72, 100],
  ],
  5: [
    [28, 35],
    [72, 35],
    [50, 70],
    [28, 105],
    [72, 105],
  ],
  6: [
    [28, 30],
    [72, 30],
    [28, 70],
    [72, 70],
    [28, 110],
    [72, 110],
  ],
  7: [
    [25, 27],
    [50, 43],
    [75, 59],
    [28, 83],
    [72, 83],
    [28, 114],
    [72, 114],
  ],
  8: [
    [28, 25],
    [72, 25],
    [28, 55],
    [72, 55],
    [28, 85],
    [72, 85],
    [28, 115],
    [72, 115],
  ],
  9: [25, 50, 75].flatMap((x) => [30, 70, 110].map((y) => [x, y])),
};
function dot(x, y, r, color) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="4"/><circle cx="${x}" cy="${y}" r="${r - 5}" fill="none" stroke="${color}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="2" fill="${color}"/>`;
}
function bamboo(x, y, color) {
  return `<g transform="translate(${x} ${y})" fill="${color}"><path d="M-4-13Q0-17 4-13L3 13Q0 17-3 13Z"/><path d="M-7-10h14v3H-7zM-7 7h14v3H-7z"/><path d="M0-8V7" stroke="#f7efcf" stroke-width="1.5"/></g>`;
}
const text = (word, y, size, color) =>
  `<text x="50" y="${y}" text-anchor="middle" font-family="Kaiti SC,STKaiti,KaiTi,Noto Serif CJK SC,serif" font-weight="700" font-size="${size}" fill="${color}">${word}</text>`;
for (let t = 0; t < 34; t++) {
  const n = (t % 9) + 1;
  let marks;
  if (t < 9)
    marks =
      text(
        ["一", "二", "三", "四", "五", "六", "七", "八", "九"][t],
        62,
        51,
        blue,
      ) + text("萬", 121, 52, red);
  else if (t < 18)
    marks =
      n === 1
        ? dot(50, 70, 32, green) + dot(50, 70, 17, red)
        : positions[n]
            .map(([x, y], i) =>
              dot(
                x,
                y,
                n < 6 ? 13 : 10,
                n === 2
                  ? green
                  : n === 3
                    ? [blue, red, green][i]
                    : n === 5 && i === 2
                      ? red
                      : n === 9
                        ? [blue, red, green][i % 3]
                        : blue,
              ),
            )
            .join("");
  else if (t === 18)
    marks = `<g stroke-linejoin="round"><path d="M26 113Q42 85 39 68Q15 54 29 37Q38 24 51 34L64 28 58 42Q67 64 60 83L79 106 60 102 73 121 53 110 45 124Z" fill="${green}"/><path d="M38 65Q55 49 60 74L49 99Q41 82 38 65" fill="${blue}"/><path d="M35 68Q44 76 47 90M40 63Q54 70 54 80" fill="none" stroke="#e8d7a4" stroke-width="3"/><path d="M38 34L40 21 45 32 52 21 52 36" fill="${red}"/><path d="M57 39L72 43 59 48" fill="${red}"/><circle cx="50" cy="40" r="2.5" fill="#efe6cc"/><path d="M36 109L24 122M45 114L38 128" stroke="${red}" stroke-width="3"/></g>`;
  else if (t < 27)
    marks = positions[n]
      .map(([x, y], i) =>
        bamboo(
          x,
          y,
          n === 7 && i < 3 ? red : n === 9 && i % 3 === 1 ? red : green,
        ),
      )
      .join("");
  else if (t === 33)
    marks = `<rect x="20" y="29" width="60" height="82" rx="2" fill="none" stroke="${blue}" stroke-width="6"/><path d="M29 36H71V104H29Z" fill="none" stroke="${blue}" stroke-width="2"/><path d="M20 43l9-7m-9 23l9-7m-9 23l9-7m-9 23l9-7m-9 23l9-7M71 36l9 7m-9 9l9 7m-9 9l9 7m-9 9l9 7m-9 9l9 7" stroke="${blue}" stroke-width="2"/>`;
  else
    marks = text(
      ["東", "南", "西", "北", "中", "發"][t - 27],
      101,
      73,
      t === 31 ? red : t === 32 ? green : blue,
    );
  await writeFile(
    new URL(`${t}.svg`, out),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150">${marks}</svg>\n`,
  );
}
console.log("Generated 34 original mahjong glyph SVGs.");
const root = new URL("../public/assets/mahjong-v1/", import.meta.url);
const names = Array.from({ length: 34 }, (_, t) =>
  t < 27
    ? `${(t % 9) + 1}${["万", "筒", "条"][Math.floor(t / 9)]}`
    : ["东风", "南风", "西风", "北风", "红中", "发财", "白板"][t - 27],
);
await writeFile(
  new URL("manifest.json", root),
  JSON.stringify(
    {
      version: 1,
      tileViewBox: [0, 0, 100, 150],
      physicalTiles: 136,
      copiesPerType: 4,
      textures: [
        { file: "tile-face.webp", width: 192, height: 288, role: "做旧牌面" },
        { file: "felt.webp", width: 768, height: 768, role: "绿毡桌布" },
        {
          file: "lobby-table.webp",
          width: 512,
          height: 512,
          role: "四人麻将桌椅",
        },
      ],
      glyphs: names.map((name, type) => ({
        type,
        name,
        file: `glyphs/${type}.svg`,
      })),
      tileStyle: "tile.css",
      preview: "preview.html",
      source: "assets/source/mahjong-v1/PROMPTS.md",
      rebuild: "node scripts/build-mahjong-assets.mjs",
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  new URL("preview.html", root),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>中国麻将 · 复古分层素材</title><link rel="stylesheet" href="tile.css"><style>*{box-sizing:border-box}body{margin:0;background:#4a6080;color:#fff0ca;font:14px serif}main{max-width:1020px;padding:24px;margin:auto}h1{font-size:24px;font-weight:normal}a{color:#ffe7a1}.tiles{display:flex;flex-wrap:wrap;gap:18px 14px;padding:24px;background:#174a37 url(felt.webp) center/cover;border:8px ridge #785534}.sample{display:flex;flex-direction:column;align-items:center;gap:10px;--mj-tile-width:50px}.sample small{font-size:12px}.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px;margin:24px 0}.table{width:100%;object-fit:contain}.mini{display:flex;gap:7px;flex-wrap:wrap;--mj-tile-width:34px}@media(max-width:650px){.layout{grid-template-columns:1fr}.table{max-width:300px}.tiles{padding:15px}.sample{--mj-tile-width:42px}}</style><main><h1>中国麻将 · 旧象牙牌与绿毡木桌</h1><p><a href="/">返回游戏大厅</a>　136 张无花牌 / 34 种牌面 / 统一 2:3 比例</p><div class="layout"><img class="table" src="lobby-table.webp" alt="四人麻将桌与木椅"><section><h2>分层结构</h2><p>做旧牌面 WebP + 精确 SVG 牌字 + 绿色牌背与厚度；联机与练习共用同一套素材。</p><p>万子使用墨蓝数字与朱红萬字，筒子为环刻圆点，索子为竹节，一索为原创鸟形，字牌为东南西北中發白。</p><p>手机实际牌宽 34px：</p><div class="mini">${[0, 4, 9, 16, 18, 24, 27, 31, 32, 33].map((t) => `<span class="mj-tile"><img src="glyphs/${t}.svg" alt="${names[t]}"></span>`).join("")}</div></section></div><div class="tiles">${names.map((name, t) => `<div class="sample"><span class="mj-tile"><img src="glyphs/${t}.svg" alt="${name}"></span><small>${name}</small></div>`).join("")}<div class="sample"><span class="mj-tile mj-tile-back" role="img" aria-label="牌背"></span><small>牌背</small></div></div></main></html>`,
);
