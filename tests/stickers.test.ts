import test from "node:test";
import assert from "node:assert/strict";
import {
  parseStickers,
  stickerList,
  getStickerPath,
  getAllStickers,
  hasStickers,
  extractStickers,
} from "../src/lib/stickers.ts";

test("parseStickers escapes HTML to prevent XSS", () => {
  const malicious = '<script>alert("xss")</script>';
  const result = parseStickers(malicious);
  assert.ok(!result.includes("<script>"));
  assert.ok(result.includes("&lt;script&gt;"));
  assert.ok(result.includes("&lt;/script&gt;"));
});

test("parseStickers escapes special characters", () => {
  const text = '& < > " \' test';
  const result = parseStickers(text);
  assert.ok(result.includes("&amp;"));
  assert.ok(result.includes("&lt;"));
  assert.ok(result.includes("&gt;"));
  assert.ok(result.includes("&quot;"));
  assert.ok(result.includes("&#39;"));
});

test("parseStickers converts [微笑] to img tag", () => {
  const text = "[微笑]";
  const result = parseStickers(text);
  assert.ok(result.includes("<img"));
  assert.ok(result.includes('class="sticker"'));
  assert.ok(result.includes("/stickers/qq-classic/微笑.svg"));
  assert.ok(result.includes('alt="[微笑]"'));
});

test("parseStickers handles mixed text and stickers", () => {
  const text = "你好 [微笑] 世界 [得意]";
  const result = parseStickers(text);
  assert.ok(result.includes("你好"));
  assert.ok(result.includes("世界"));
  assert.ok(result.includes("<img"));
  const imgCount = (result.match(/<img/g) || []).length;
  assert.equal(imgCount, 2);
});

test("parseStickers handles text without stickers", () => {
  const text = "Plain text without stickers";
  const result = parseStickers(text);
  assert.ok(result.includes("Plain text without stickers"));
  assert.ok(!result.includes("<img"));
});

test("parseStickers ignores unknown sticker names", () => {
  const text = "[unknown] [微笑]";
  const result = parseStickers(text);
  assert.ok(result.includes("[unknown]"));
  assert.ok(result.includes("<img"));
  const imgCount = (result.match(/<img/g) || []).length;
  assert.equal(imgCount, 1);
});

test("parseStickers prevents nested script injection", () => {
  const text = '[微笑]<img src=x onerror="alert(1)">';
  const result = parseStickers(text);
  assert.ok(!result.includes('onerror="alert'));
  assert.ok(!result.includes('<img src=x'));
  assert.ok(result.includes("&lt;img"));
  assert.ok(result.includes("&quot;"));
});

test("stickerList contains expected categories", () => {
  const categories = Object.keys(stickerList);
  assert.ok(categories.includes("常用"));
  assert.ok(categories.includes("表情"));
  assert.ok(categories.includes("手势"));
  assert.ok(categories.includes("符号"));
});

test("stickerList categories contain name arrays", () => {
  for (const category of Object.values(stickerList)) {
    assert.ok(Array.isArray(category));
    assert.ok(category.length > 0);
    for (const name of category) {
      assert.equal(typeof name, "string");
      assert.ok(name.length > 0);
    }
  }
});

test("getStickerPath returns valid path for known stickers", () => {
  const path = getStickerPath("微笑");
  assert.equal(path, "/stickers/qq-classic/微笑.svg");
});

test("getStickerPath returns null for unknown stickers", () => {
  const path = getStickerPath("unknown");
  assert.equal(path, null);
});

test("getAllStickers returns all sticker names", () => {
  const all = getAllStickers();
  assert.ok(Array.isArray(all));
  assert.ok(all.length > 50);
  assert.ok(all.includes("微笑"));
  assert.ok(all.includes("得意"));
  assert.ok(all.includes("爱心"));
});

test("hasStickers detects sticker patterns", () => {
  assert.ok(hasStickers("[微笑]"));
  assert.ok(hasStickers("hello [微笑] world"));
  assert.ok(hasStickers("[unknown]"));
  assert.ok(!hasStickers("no stickers here"));
});

test("extractStickers extracts valid sticker names", () => {
  const text = "你好 [微笑] 世界 [unknown] [得意]";
  const stickers = extractStickers(text);
  assert.equal(stickers.length, 2);
  assert.ok(stickers.includes("微笑"));
  assert.ok(stickers.includes("得意"));
  assert.ok(!stickers.includes("unknown"));
});

test("parseStickers handles extremely long text safely", () => {
  const longText = "a".repeat(1000) + "[微笑]" + "b".repeat(1000);
  const result = parseStickers(longText);
  assert.ok(result.length > 2000);
  assert.ok(result.includes("<img"));
});

test("parseStickers preserves whitespace", () => {
  const text = "  [微笑]  \n  [得意]  ";
  const result = parseStickers(text);
  assert.ok(result.includes("<img"));
  const imgCount = (result.match(/<img/g) || []).length;
  assert.equal(imgCount, 2);
});

test("parseStickers handles multiple consecutive stickers", () => {
  const text = "[微笑][得意][流泪]";
  const result = parseStickers(text);
  const imgCount = (result.match(/<img/g) || []).length;
  assert.equal(imgCount, 3);
});

test("parseStickers handles empty brackets", () => {
  const text = "[] [微笑]";
  const result = parseStickers(text);
  assert.ok(result.includes("[]"));
  const imgCount = (result.match(/<img/g) || []).length;
  assert.equal(imgCount, 1);
});

test("classic QQ sticker names are included", () => {
  const all = getAllStickers();
  const classics = [
    "微笑", "撇嘴", "色", "发呆", "得意", "流泪", "害羞", "闭嘴",
    "睡", "大哭", "尴尬", "发怒", "调皮", "呲牙", "惊讶", "难过",
    "酷", "冷汗", "抓狂", "吐", "偷笑", "可爱", "白眼", "傲慢",
    "玫瑰", "爱心", "强", "弱", "OK",
  ];
  for (const name of classics) {
    assert.ok(all.includes(name), `Missing classic sticker: ${name}`);
  }
});
