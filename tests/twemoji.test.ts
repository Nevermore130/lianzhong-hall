import test from "node:test";
import assert from "node:assert/strict";
import { parseTwemoji, emojiList } from "../src/lib/twemoji.ts";

test("parseTwemoji escapes HTML to prevent XSS", () => {
  const malicious = '<script>alert("xss")</script>';
  const result = parseTwemoji(malicious);
  assert.ok(!result.includes("<script>"));
  assert.ok(result.includes("&lt;script&gt;"));
  assert.ok(result.includes("&lt;/script&gt;"));
});

test("parseTwemoji escapes special characters", () => {
  const text = '& < > " \' test';
  const result = parseTwemoji(text);
  assert.ok(result.includes("&amp;"));
  assert.ok(result.includes("&lt;"));
  assert.ok(result.includes("&gt;"));
  assert.ok(result.includes("&quot;"));
  assert.ok(result.includes("&#39;"));
});

test("parseTwemoji converts emoji to Twemoji img tags", () => {
  const emoji = "😀";
  const result = parseTwemoji(emoji);
  assert.ok(result.includes("<img"));
  assert.ok(result.includes('class="emoji"'));
  assert.ok(result.includes(".svg"));
  assert.ok(result.includes("cdn.jsdelivr.net"));
});

test("parseTwemoji handles mixed text and emoji", () => {
  const text = "Hello 😀 world 👋";
  const result = parseTwemoji(text);
  assert.ok(result.includes("Hello"));
  assert.ok(result.includes("world"));
  assert.ok(result.includes("<img"));
  const imgCount = (result.match(/<img/g) || []).length;
  assert.equal(imgCount, 2);
});

test("parseTwemoji handles text without emoji", () => {
  const text = "Plain text without emoji";
  const result = parseTwemoji(text);
  assert.ok(result.includes("Plain text without emoji"));
  assert.ok(!result.includes("<img"));
});

test("parseTwemoji prevents nested script injection in emoji context", () => {
  const text = '😀<img src=x onerror="alert(1)">';
  const result = parseTwemoji(text);
  // Check that dangerous unescaped patterns don't exist
  assert.ok(!result.includes('onerror="alert'));
  assert.ok(!result.includes('<img src=x'));
  // Check that HTML is properly escaped
  assert.ok(result.includes("&lt;img"));
  assert.ok(result.includes('&quot;'));
  assert.ok(result.includes('onerror=&quot;'));
});

test("emojiList contains expected categories", () => {
  const categories = Object.keys(emojiList);
  assert.ok(categories.includes("表情"));
  assert.ok(categories.includes("手势"));
  assert.ok(categories.includes("符号"));
  assert.ok(categories.includes("游戏"));
  assert.ok(categories.includes("食物"));
});

test("emojiList categories contain emoji arrays", () => {
  for (const category of Object.values(emojiList)) {
    assert.ok(Array.isArray(category));
    assert.ok(category.length > 0);
    for (const emoji of category) {
      assert.equal(typeof emoji, "string");
      assert.ok(emoji.length > 0);
    }
  }
});

test("parseTwemoji handles extremely long text safely", () => {
  const longText = "a".repeat(1000) + "😀" + "b".repeat(1000);
  const result = parseTwemoji(longText);
  assert.ok(result.length > 2000);
  assert.ok(result.includes("<img"));
});
