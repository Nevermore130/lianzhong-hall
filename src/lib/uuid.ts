/**
 * 生成 UUID v4 字符串。
 * 
 * 在安全上下文（HTTPS、localhost）中优先使用 crypto.randomUUID。
 * 在非安全 HTTP 环境中回退到基于 crypto.getRandomValues 的实现。
 * 
 * @returns RFC 4122 版本 4 UUID 字符串
 */
export function generateUUID(): string {
  // 优先使用原生 crypto.randomUUID（安全上下文）
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // 回退：使用 crypto.getRandomValues 生成 UUID v4
  // 参考 RFC 4122: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // 其中 4 表示版本 4，y 的首两位固定为 10（即 8、9、a、b）
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // 设置版本 (4) 和变体 (RFC 4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // 版本 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // 变体 10xx

    // 转换为 UUID 字符串格式
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // 如果连 crypto.getRandomValues 都不可用（极端情况），
  // 使用 Math.random 作为最后的回退（安全性较低，但至少功能可用）
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
