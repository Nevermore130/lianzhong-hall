import { mkdirSync, writeFileSync } from "node:fs";
const folder = new URL("../public/assets/doudizhu-v1/cards/", import.meta.url);
mkdirSync(folder, { recursive: true });
const suits = ["♠", "♥", "♣", "♦"];
const faces = {
  J: '<path d="M-13-13L-10-23 10-25 16-13Z" fill="#476d7d"/><path d="M7-24Q18-43 20-27L12-20" fill="#e5c17d"/><path d="M-14 11L-21 30H21L13 11" fill="#476d7d"/>',
  Q: '<path d="M-12-15L-14-27-5-22 0-31 6-22 14-27 11-15Z" fill="#d4aa50"/><path d="M-13 9L-23 30H23L13 9" fill="#a33f48"/><path d="M-14-10Q-23 6-14 20M14-10Q23 6 14 20" fill="none" stroke="#5b3f30" stroke-width="5"/>',
  K: '<path d="M-14-15L-16-29-7-23 0-32 7-23 16-29 13-15Z" fill="#d4aa50"/><path d="M-13 10L-23 30H23L13 10" fill="#746088"/><path d="M-11 0Q0 27 11 0L6 6 0 3-6 6Z" fill="#5b3f30"/>',
};
for (let card = 0; card < 54; card++) {
  const rank = card >= 52 ? card - 36 : Math.floor(card / 4) + 3;
  const label =
    { 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2" }[rank] ?? String(rank);
  const color =
    card >= 52
      ? card === 53
        ? "#a12732"
        : "#233546"
      : card % 4 === 1 || card % 4 === 3
        ? "#a12732"
        : "#233546";
  const suit = suits[card % 4];
  const corner =
    card >= 52
      ? '<text x="6" y="16" font-size="11">J</text><text x="6" y="27" font-size="11">O</text><text x="6" y="38" font-size="11">K</text><text x="6" y="49" font-size="11">E</text><text x="6" y="60" font-size="11">R</text>'
      : '<text x="6" y="20" font-size="19">' +
        label +
        '</text><text x="6" y="35" font-size="16">' +
        suit +
        "</text>";
  let center = "";
  if (card >= 52) {
    center =
      '<g transform="translate(42 52)" stroke="' +
      color +
      '" stroke-width="1.2"><path d="M-16-5Q-29-30-11-20L0-33 9-19Q30-29 16-3Z" fill="' +
      color +
      '"/><circle cx="-22" cy="-24" r="3" fill="#d5ad59"/><circle cx="0" cy="-33" r="3" fill="#d5ad59"/><circle cx="22" cy="-24" r="3" fill="#d5ad59"/><path d="M-13-9Q-18 22 0 24Q18 22 13-9Z" fill="#f0d6b1"/><path d="M-8 5L-3 4M3 4L8 5M-5 14Q0 19 5 14" fill="none"/><path d="M-15 20L-21 35 0 28 21 35 15 20" fill="' +
      color +
      '"/></g><text x="40" y="99" text-anchor="middle" font-size="10">' +
      (card === 53 ? "大 王" : "小 王") +
      "</text>";
  } else if (faces[label]) {
    center =
      '<rect x="23" y="21" width="35" height="75" rx="1" fill="#efe2c3" stroke="#b49a6c" stroke-width=".6"/><g transform="translate(40 58) scale(.65)" stroke="#5e4938" stroke-width="1.1">' +
      faces[label] +
      '<path d="M-12-13Q-14 8 0 12Q14 8 12-13Z" fill="#ebcda4"/><path d="M-8-3L-3-3M3-3L8-3M0-2V3L3 4M-4 7H4" fill="none"/><path d="M-11 13L0 25 11 13M0 25V30" fill="none" stroke="#dfc57e" stroke-width="2"/></g><text x="40" y="89" text-anchor="middle" font-size="14">' +
      suit +
      "</text>";
  } else {
    const n = rank === 14 ? 1 : rank === 15 ? 2 : rank;
    const positions =
      n === 1
        ? [[40, 63]]
        : n === 2
          ? [
              [40, 39],
              [40, 79],
            ]
          : n === 3
            ? [
                [40, 34],
                [40, 59],
                [40, 84],
              ]
            : [...Array(Math.floor(n / 2))]
                .flatMap((_, i) => [
                  [28, 28 + (i * 60) / (Math.floor(n / 2) - 1)],
                  [52, 28 + (i * 60) / (Math.floor(n / 2) - 1)],
                ])
                .concat(n % 2 ? [[40, 58]] : []);
    center = positions
      .map(
        ([x, y]) =>
          '<text x="' +
          x +
          '" y="' +
          y +
          '" text-anchor="middle" dominant-baseline="central" font-size="' +
          (n === 1 ? 34 : 17) +
          '">' +
          suit +
          "</text>",
      )
      .join("");
  }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 116"><defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#fffdf3"/><stop offset="1" stop-color="#e9e0c8"/></linearGradient><pattern id="grain" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 0h1" stroke="#aa987333" stroke-width=".35"/></pattern></defs><rect x=".8" y=".8" width="78.4" height="114.4" rx="4" fill="url(#paper)" stroke="#544c3b" stroke-width="1.3"/><rect x="2" y="2" width="76" height="112" rx="3" fill="url(#grain)" stroke="#fffefa" stroke-width=".7"/><g fill="' +
    color +
    '" font-family="Georgia,serif" font-weight="bold">' +
    corner +
    '<g transform="translate(80 116) rotate(180)">' +
    corner +
    "</g>" +
    center +
    "</g></svg>";
  writeFileSync(new URL(card + ".svg", folder), svg + "\n");
}
writeFileSync(
  new URL("../landlord.svg", folder),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 1L36 9v15L20 39 4 24V9Z" fill="#9c3628" stroke="#e6c67a" stroke-width="2"/><path d="M12 22l2-13h12l2 13" fill="#253233" stroke="#e5c986"/><path d="M13 17h14v5H13Z" fill="#b47331"/><path d="M8 22q12 6 24 0v4q-12 5-24 0Z" fill="#273335" stroke="#f0d393"/></svg>\n',
);
