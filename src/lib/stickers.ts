/**
 * QQ Classic Yellow-Face Sticker System
 * Original artwork for Lianzhong Hall - NOT Tencent IP
 */

export type StickerName = string;

/**
 * All available stickers organized by category.
 * Using Chinese shortcode names like [微笑].
 */
export const stickerList = {
  常用: [
    "微笑", "撇嘴", "色", "发呆", "得意", "流泪", "害羞", "闭嘴",
    "睡", "大哭", "尴尬", "发怒", "调皮", "呲牙", "惊讶", "难过",
  ],
  表情: [
    "酷", "冷汗", "抓狂", "吐", "偷笑", "可爱", "白眼", "傲慢",
    "饥饿", "困", "惊恐", "流汗", "憨笑", "大兵", "奋斗", "咒骂",
    "疑问", "嘘", "晕", "折磨", "衰", "糗大了", "坏笑",
  ],
  手势: [
    "左哼哼", "右哼哼", "哈欠", "鄙视", "委屈", "快哭了", "阴险",
    "亲亲", "吓", "可怜", "敲打", "再见", "擦汗", "抠鼻", "鼓掌",
    "握手", "胜利", "抱拳", "拳头", "OK",
  ],
  符号: [
    "玫瑰", "爱心", "心碎", "蛋糕", "炸弹", "刀", "足球", "便便",
    "月亮", "太阳", "礼物", "拥抱", "强", "弱",
  ],
} as const;

/**
 * Get all sticker names as a flat array
 */
export function getAllStickers(): StickerName[] {
  return Object.values(stickerList).flat();
}

/**
 * Map of sticker names to their SVG file paths
 */
const stickerPathMap = new Map<string, string>();

// Populate the map with all stickers
for (const names of Object.values(stickerList)) {
  for (const name of names) {
    stickerPathMap.set(name, `/stickers/qq-classic/${name}.svg`);
  }
}

/**
 * Get the SVG path for a sticker name
 * @param name - Chinese sticker name (e.g., "微笑")
 * @returns Path to SVG file or null if not found
 */
export function getStickerPath(name: string): string | null {
  return stickerPathMap.get(name) ?? null;
}

/**
 * Parse text and replace [shortcode] patterns with sticker img tags.
 * XSS-safe: escapes HTML in text before injecting sticker img tags.
 *
 * @param text - User text that may contain [微笑] style shortcodes
 * @returns HTML string with sticker img tags
 */
export function parseStickers(text: string): string {
  // First, escape HTML to prevent XSS
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Replace known [shortcode] patterns with img tags
  // Using halfwidth brackets [微笑]
  return escaped.replace(/\[([^\]]+)\]/g, (match, name) => {
    const path = getStickerPath(name);
    if (path) {
      // Return img tag for valid stickers
      return `<img class="sticker" src="${path}" alt="[${name}]" title="${name}" loading="lazy" />`;
    }
    // Keep unknown patterns as text (already escaped)
    return match;
  });
}

/**
 * Check if a text contains any sticker shortcodes
 */
export function hasStickers(text: string): boolean {
  return /\[[^\]]+\]/.test(text);
}

/**
 * Extract all sticker names from text
 * @param text - Text that may contain [shortcode] patterns
 * @returns Array of found sticker names
 */
export function extractStickers(text: string): string[] {
  const matches = text.matchAll(/\[([^\]]+)\]/g);
  const names: string[] = [];
  for (const match of matches) {
    const name = match[1];
    if (getStickerPath(name)) {
      names.push(name);
    }
  }
  return names;
}
