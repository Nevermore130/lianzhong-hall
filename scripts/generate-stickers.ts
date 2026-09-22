/**
 * Generate original yellow-face stickers inspired by classic QQ style.
 * These are NOT Tencent assets - original artwork for this project.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const STICKER_DIR = join(process.cwd(), "public/stickers/qq-classic");

// Base SVG template for round yellow face
function createFaceSVG(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!-- Yellow face circle -->
  <circle cx="50" cy="50" r="48" fill="#FFD700" stroke="#000" stroke-width="2"/>
  ${content}
</svg>`;
}

// Sticker definitions with Chinese names and SVG content
const stickers: Record<string, string> = {
  // Basic emotions
  微笑: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 30 60 Q 50 75 70 60" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
  `,
  
  撇嘴: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 30 65 Q 50 55 70 65" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
  `,
  
  色: `
    <ellipse cx="35" cy="42" rx="3" ry="6" fill="#000"/>
    <ellipse cx="65" cy="42" rx="3" ry="6" fill="#000"/>
    <path d="M 30 60 Q 50 72 70 60" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <circle cx="20" cy="55" r="8" fill="#FF6B6B" opacity="0.6"/>
    <circle cx="80" cy="55" r="8" fill="#FF6B6B" opacity="0.6"/>
  `,
  
  发呆: `
    <circle cx="35" cy="40" r="6" fill="#000"/>
    <circle cx="65" cy="40" r="6" fill="#000"/>
    <circle cx="35" cy="38" r="2" fill="#fff"/>
    <circle cx="65" cy="38" r="2" fill="#fff"/>
    <ellipse cx="50" cy="65" rx="8" ry="5" fill="#000"/>
  `,
  
  得意: `
    <path d="M 25 38 Q 35 32 45 38" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 55 38 Q 65 32 75 38" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 30 58 Q 50 70 70 58" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
  `,
  
  流泪: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 30 65 Q 50 55 70 65" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 35 50 L 35 70" stroke="#4A90E2" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 65 50 L 65 70" stroke="#4A90E2" stroke-width="2.5" stroke-linecap="round"/>
  `,
  
  害羞: `
    <path d="M 28 38 L 42 38" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 58 38 L 72 38" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 35 60 Q 50 68 65 60" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="25" cy="55" r="10" fill="#FF6B6B" opacity="0.5"/>
    <circle cx="75" cy="55" r="10" fill="#FF6B6B" opacity="0.5"/>
  `,
  
  闭嘴: `
    <path d="M 28 40 Q 35 35 42 40" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 58 40 Q 65 35 72 40" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="35" y1="63" x2="65" y2="63" stroke="#000" stroke-width="3" stroke-linecap="round"/>
  `,
  
  睡: `
    <path d="M 28 42 L 45 42" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 55 42 L 72 42" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="50" cy="65" rx="12" ry="6" fill="#000"/>
    <text x="70" y="25" font-size="14" fill="#000">Z</text>
    <text x="75" y="18" font-size="10" fill="#000">z</text>
  `,
  
  大哭: `
    <path d="M 25 35 Q 35 28 45 35" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 55 35 Q 65 28 75 35" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 35 70 Q 50 82 65 70" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/>
    <path d="M 30 45 L 25 75" stroke="#4A90E2" stroke-width="3" stroke-linecap="round"/>
    <path d="M 70 45 L 75 75" stroke="#4A90E2" stroke-width="3" stroke-linecap="round"/>
  `,
  
  尴尬: `
    <ellipse cx="35" cy="38" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="38" rx="5" ry="8" fill="#000"/>
    <path d="M 30 60 L 45 63 L 55 57 L 70 60" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="45" y1="20" x2="48" y2="10" stroke="#000" stroke-width="2"/>
    <line x1="55" y1="20" x2="52" y2="10" stroke="#000" stroke-width="2"/>
  `,
  
  发怒: `
    <ellipse cx="35" cy="42" rx="6" ry="9" fill="#000"/>
    <ellipse cx="65" cy="42" rx="6" ry="9" fill="#000"/>
    <path d="M 28 65 L 72 65" stroke="#000" stroke-width="4" stroke-linecap="round"/>
    <path d="M 20 28 L 30 35" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 80 28 L 70 35" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="50" fill="#FF6B6B" opacity="0.15"/>
  `,
  
  调皮: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 60 35 Q 65 40 70 35" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 30 60 Q 50 72 70 60" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <circle cx="68" cy="40" r="2" fill="#000"/>
  `,
  
  呲牙: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 30 58 Q 50 70 70 58" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <rect x="38" y="62" width="24" height="10" fill="#FFF" stroke="#000" stroke-width="1.5"/>
    <line x1="50" y1="62" x2="50" y2="72" stroke="#000" stroke-width="1.5"/>
  `,
  
  惊讶: `
    <circle cx="35" cy="38" r="8" fill="#000"/>
    <circle cx="65" cy="38" r="8" fill="#000"/>
    <circle cx="35" cy="36" r="3" fill="#fff"/>
    <circle cx="65" cy="36" r="3" fill="#fff"/>
    <circle cx="50" cy="68" r="10" fill="#000"/>
  `,
  
  难过: `
    <path d="M 25 38 Q 35 32 45 38" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 55 38 Q 65 32 75 38" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 30 68 Q 50 58 70 68" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
  `,
  
  酷: `
    <rect x="22" y="36" width="20" height="8" rx="2" fill="#000"/>
    <rect x="58" y="36" width="20" height="8" rx="2" fill="#000"/>
    <line x1="42" y1="40" x2="58" y2="40" stroke="#000" stroke-width="2"/>
    <path d="M 35 62 L 65 62" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
  `,
  
  冷汗: `
    <ellipse cx="35" cy="42" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="42" rx="5" ry="8" fill="#000"/>
    <path d="M 30 62 Q 50 52 70 62" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <circle cx="20" cy="30" r="4" fill="#4A90E2" opacity="0.7"/>
    <circle cx="18" cy="40" r="3" fill="#4A90E2" opacity="0.7"/>
  `,
  
  抓狂: `
    <path d="M 30 45 Q 35 35 40 45" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 60 45 Q 65 35 70 45" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 30 70 Q 50 82 70 70" fill="none" stroke="#000" stroke-width="4"/>
    <path d="M 30 15 Q 35 8 40 15" fill="none" stroke="#000" stroke-width="2.5"/>
    <path d="M 60 15 Q 65 8 70 15" fill="none" stroke="#000" stroke-width="2.5"/>
  `,
  
  吐: `
    <ellipse cx="32" cy="40" rx="4" ry="7" fill="#000"/>
    <path d="M 60 35 L 68 35" stroke="#000" stroke-width="2.5"/>
    <circle cx="64" cy="35" r="1.5" fill="#000"/>
    <path d="M 42 58 Q 35 62 28 65" fill="none" stroke="#8B4513" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="68" r="3" fill="#8B4513"/>
  `,
  
  偷笑: `
    <ellipse cx="35" cy="38" rx="4" ry="7" fill="#000"/>
    <ellipse cx="65" cy="38" rx="4" ry="7" fill="#000"/>
    <path d="M 32 58 Q 50 68 68 58" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <path d="M 10 45 Q 20 50 10 55" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>
  `,
  
  可爱: `
    <ellipse cx="35" cy="42" rx="4" ry="8" fill="#000"/>
    <ellipse cx="65" cy="42" rx="4" ry="8" fill="#000"/>
    <path d="M 32 60 Q 50 70 68 60" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="22" cy="52" r="9" fill="#FFB6C1" opacity="0.6"/>
    <circle cx="78" cy="52" r="9" fill="#FFB6C1" opacity="0.6"/>
  `,
  
  白眼: `
    <circle cx="35" cy="40" r="7" fill="#fff" stroke="#000" stroke-width="2"/>
    <circle cx="65" cy="40" r="7" fill="#fff" stroke="#000" stroke-width="2"/>
    <circle cx="32" cy="38" r="3" fill="#000"/>
    <circle cx="62" cy="38" r="3" fill="#000"/>
    <line x1="35" y1="62" x2="65" y2="62" stroke="#000" stroke-width="2.5"/>
  `,
  
  傲慢: `
    <path d="M 28 40 L 42 40" stroke="#000" stroke-width="2.5"/>
    <path d="M 58 40 L 72 40" stroke="#000" stroke-width="2.5"/>
    <path d="M 35 58 Q 50 52 65 58" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>
  `,
  
  饥饿: `
    <ellipse cx="35" cy="35" rx="5" ry="9" fill="#000"/>
    <ellipse cx="65" cy="35" rx="5" ry="9" fill="#000"/>
    <path d="M 35 70 Q 50 78 65 70" fill="none" stroke="#000" stroke-width="4"/>
    <path d="M 25 60 Q 50 50 75 60" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="3,2"/>
  `,
  
  困: `
    <path d="M 25 40 Q 35 38 45 40" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 55 40 Q 65 38 75 40" fill="none" stroke="#000" stroke-width="3"/>
    <ellipse cx="50" cy="65" rx="10" ry="5" fill="#000"/>
    <circle cx="18" cy="28" r="3" fill="#4A90E2" opacity="0.6"/>
  `,
  
  惊恐: `
    <circle cx="33" cy="38" r="9" fill="#fff" stroke="#000" stroke-width="2.5"/>
    <circle cx="67" cy="38" r="9" fill="#fff" stroke="#000" stroke-width="2.5"/>
    <circle cx="33" cy="38" r="5" fill="#000"/>
    <circle cx="67" cy="38" r="5" fill="#000"/>
    <circle cx="50" cy="70" r="12" fill="#000"/>
    <path d="M 35 15 L 40 8" stroke="#000" stroke-width="2"/>
  `,
  
  流汗: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 35 60 Q 50 68 65 60" fill="none" stroke="#000" stroke-width="2.5"/>
    <circle cx="18" cy="35" r="5" fill="#4A90E2" opacity="0.7"/>
    <circle cx="16" cy="45" r="4" fill="#4A90E2" opacity="0.7"/>
    <circle cx="14" cy="55" r="3" fill="#4A90E2" opacity="0.7"/>
  `,
  
  憨笑: `
    <path d="M 28 38 Q 35 32 42 38" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 58 38 Q 65 32 72 38" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 28 58 Q 50 75 72 58" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/>
  `,
  
  大兵: `
    <ellipse cx="35" cy="42" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="42" rx="5" ry="8" fill="#000"/>
    <line x1="30" y1="62" x2="70" y2="62" stroke="#000" stroke-width="3"/>
    <rect x="25" y="10" width="50" height="15" fill="#4A7C59" stroke="#000" stroke-width="2"/>
    <circle cx="50" cy="17" r="4" fill="#FFD700"/>
  `,
  
  奋斗: `
    <path d="M 28 40 Q 35 35 42 40" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 58 40 Q 65 35 72 40" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 35 60 Q 50 68 65 60" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 80 35 L 88 28" stroke="#FF6B6B" stroke-width="3"/>
    <path d="M 82 42 L 92 42" stroke="#FF6B6B" stroke-width="3"/>
  `,
  
  咒骂: `
    <path d="M 25 38 Q 35 32 45 38" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 55 38 Q 65 32 75 38" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 35 68 Q 50 58 65 68" fill="none" stroke="#000" stroke-width="3"/>
    <text x="68" y="30" font-size="18" fill="#000" font-weight="bold">#</text>
    <text x="75" y="22" font-size="14" fill="#000">!</text>
  `,
  
  疑问: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="50" cy="62" rx="8" ry="5" fill="#000"/>
    <text x="70" y="32" font-size="24" fill="#000" font-weight="bold">?</text>
  `,
  
  嘘: `
    <ellipse cx="35" cy="38" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="38" rx="5" ry="8" fill="#000"/>
    <line x1="35" y1="62" x2="65" y2="62" stroke="#000" stroke-width="2.5"/>
    <line x1="70" y1="55" x2="85" y2="55" stroke="#000" stroke-width="3"/>
  `,
  
  晕: `
    <path d="M 25 38 Q 35 45 45 38" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 55 38 Q 65 45 75 38" fill="none" stroke="#000" stroke-width="3"/>
    <ellipse cx="50" cy="65" rx="12" ry="6" fill="#000"/>
    <circle cx="30" cy="25" r="3" fill="none" stroke="#000" stroke-width="2"/>
    <circle cx="70" cy="25" r="3" fill="none" stroke="#000" stroke-width="2"/>
  `,
  
  折磨: `
    <path d="M 28 42 Q 35 35 42 42" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 58 42 Q 65 35 72 42" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 30 65 L 70 65" stroke="#000" stroke-width="3"/>
    <path d="M 15 50 Q 20 55 15 60" fill="none" stroke="#4A90E2" stroke-width="2"/>
  `,
  
  衰: `
    <path d="M 25 40 L 45 40" stroke="#000" stroke-width="3"/>
    <path d="M 55 40 L 75 40" stroke="#000" stroke-width="3"/>
    <path d="M 30 65 Q 50 58 70 65" fill="none" stroke="#000" stroke-width="3"/>
  `,
  
  敲打: `
    <path d="M 28 45 Q 35 40 42 45" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 58 45 Q 65 40 72 45" fill="none" stroke="#000" stroke-width="3"/>
    <ellipse cx="50" cy="68" rx="10" ry="5" fill="#000"/>
    <rect x="65" y="10" width="15" height="20" fill="#8B4513" stroke="#000" stroke-width="2"/>
    <circle cx="72" cy="15" r="2" fill="#FFD700"/>
  `,
  
  再见: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 35 60 Q 50 68 65 60" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 75 35 L 85 30 L 85 40 L 75 35" fill="#FFD700" stroke="#000" stroke-width="1.5"/>
  `,
  
  擦汗: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 35 62 Q 50 58 65 62" fill="none" stroke="#000" stroke-width="2.5"/>
    <rect x="5" y="30" width="12" height="15" fill="#87CEEB" stroke="#000" stroke-width="1.5"/>
    <circle cx="17" cy="42" r="4" fill="#4A90E2" opacity="0.6"/>
  `,
  
  抠鼻: `
    <ellipse cx="30" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <line x1="35" y1="62" x2="65" y2="62" stroke="#000" stroke-width="2.5"/>
    <path d="M 42 55 L 48 58" stroke="#F5DEB3" stroke-width="3" stroke-linecap="round"/>
  `,
  
  鼓掌: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 35 60 Q 50 70 65 60" fill="none" stroke="#000" stroke-width="3"/>
    <rect x="8" y="60" width="15" height="20" rx="3" fill="#FFD700" stroke="#000" stroke-width="1.5"/>
    <rect x="77" y="60" width="15" height="20" rx="3" fill="#FFD700" stroke="#000" stroke-width="1.5"/>
  `,
  
  糗大了: `
    <circle cx="35" cy="40" r="8" fill="#000"/>
    <circle cx="65" cy="40" r="8" fill="#000"/>
    <circle cx="35" cy="38" r="3" fill="#fff"/>
    <circle cx="65" cy="38" r="3" fill="#fff"/>
    <circle cx="50" cy="68" r="12" fill="#000"/>
    <circle cx="50" cy="50" r="50" fill="#FF6B6B" opacity="0.2"/>
  `,
  
  坏笑: `
    <path d="M 28 40 L 42 40" stroke="#000" stroke-width="2.5"/>
    <path d="M 58 40 L 72 40" stroke="#000" stroke-width="2.5"/>
    <path d="M 30 55 Q 40 62 50 60 Q 60 58 70 62" fill="none" stroke="#000" stroke-width="3"/>
  `,
  
  左哼哼: `
    <ellipse cx="30" cy="40" rx="5" ry="8" fill="#000"/>
    <circle cx="68" cy="40" r="3" fill="#000"/>
    <path d="M 38 60 Q 48 65 58 60" fill="none" stroke="#000" stroke-width="2.5"/>
  `,
  
  右哼哼: `
    <circle cx="32" cy="40" r="3" fill="#000"/>
    <ellipse cx="70" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 42 60 Q 52 65 62 60" fill="none" stroke="#000" stroke-width="2.5"/>
  `,
  
  哈欠: `
    <path d="M 25 35 Q 35 30 45 35" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 55 35 Q 65 30 75 35" fill="none" stroke="#000" stroke-width="3"/>
    <circle cx="50" cy="70" r="14" fill="#000"/>
    <path d="M 35 55 L 40 50" stroke="#4A90E2" stroke-width="2"/>
  `,
  
  鄙视: `
    <path d="M 28 38 L 42 38" stroke="#000" stroke-width="2.5"/>
    <path d="M 58 38 L 72 38" stroke="#000" stroke-width="2.5"/>
    <path d="M 32 62 Q 50 58 68 62" fill="none" stroke="#000" stroke-width="2.5"/>
  `,
  
  委屈: `
    <path d="M 25 35 Q 35 30 45 35" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 55 35 Q 65 30 75 35" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 30 65 Q 50 58 70 65" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 35 45 L 35 55" stroke="#4A90E2" stroke-width="2"/>
  `,
  
  快哭了: `
    <path d="M 25 35 Q 35 28 45 35" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 55 35 Q 65 28 75 35" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 30 68 Q 50 60 70 68" fill="none" stroke="#000" stroke-width="3"/>
    <circle cx="32" cy="48" r="3" fill="#4A90E2" opacity="0.7"/>
    <circle cx="68" cy="48" r="3" fill="#4A90E2" opacity="0.7"/>
  `,
  
  阴险: `
    <path d="M 28 38 Q 35 35 42 38" fill="none" stroke="#000" stroke-width="2.5"/>
    <path d="M 58 38 Q 65 35 72 38" fill="none" stroke="#000" stroke-width="2.5"/>
    <path d="M 28 58 Q 38 62 50 60 Q 62 58 72 62" fill="none" stroke="#000" stroke-width="3"/>
  `,
  
  亲亲: `
    <path d="M 28 38 Q 35 32 42 38" fill="none" stroke="#000" stroke-width="2.5"/>
    <path d="M 58 38 Q 65 32 72 38" fill="none" stroke="#000" stroke-width="2.5"/>
    <ellipse cx="50" cy="65" rx="8" ry="5" fill="#FF69B4" stroke="#000" stroke-width="1.5"/>
    <circle cx="85" cy="50" r="4" fill="#FF69B4"/>
    <circle cx="90" cy="55" r="3" fill="#FF69B4"/>
  `,
  
  吓: `
    <circle cx="35" cy="40" r="10" fill="#fff" stroke="#000" stroke-width="3"/>
    <circle cx="65" cy="40" r="10" fill="#fff" stroke="#000" stroke-width="3"/>
    <circle cx="35" cy="40" r="6" fill="#000"/>
    <circle cx="65" cy="40" r="6" fill="#000"/>
    <circle cx="50" cy="72" r="14" fill="#000"/>
  `,
  
  可怜: `
    <circle cx="35" cy="38" r="7" fill="#000"/>
    <circle cx="65" cy="38" r="7" fill="#000"/>
    <circle cx="35" cy="36" r="3" fill="#fff"/>
    <circle cx="65" cy="36" r="3" fill="#fff"/>
    <path d="M 30 68 Q 50 60 70 68" fill="none" stroke="#000" stroke-width="3"/>
    <circle cx="32" cy="50" r="2" fill="#4A90E2"/>
  `,

  // Symbol stickers
  玫瑰: `
    <path d="M 50 20 Q 40 30 45 40 Q 50 35 55 40 Q 60 30 50 20" fill="#FF1493" stroke="#8B008B" stroke-width="2"/>
    <ellipse cx="50" cy="40" rx="8" ry="10" fill="#FF69B4" stroke="#8B008B" stroke-width="2"/>
    <path d="M 50 45 L 50 75" stroke="#228B22" stroke-width="3"/>
    <path d="M 50 55 Q 40 58 38 65" fill="#228B22" stroke="#228B22" stroke-width="1"/>
    <path d="M 50 60 Q 60 63 62 70" fill="#228B22" stroke="#228B22" stroke-width="1"/>
  `,
  
  爱心: `
    <path d="M 50 75 L 30 50 Q 25 40 25 32 Q 25 20 35 20 Q 45 20 50 28 Q 55 20 65 20 Q 75 20 75 32 Q 75 40 70 50 Z" fill="#FF1493" stroke="#C71585" stroke-width="2"/>
  `,
  
  心碎: `
    <path d="M 50 75 L 30 50 Q 25 40 25 32 Q 25 20 35 20 Q 45 20 50 28 Q 55 20 65 20 Q 75 20 75 32 Q 75 40 70 50 Z" fill="#888" stroke="#555" stroke-width="2"/>
    <path d="M 50 28 L 48 75" stroke="#000" stroke-width="3"/>
    <path d="M 52 28 L 54 75" stroke="#000" stroke-width="3"/>
  `,
  
  蛋糕: `
    <rect x="25" y="60" width="50" height="20" fill="#FFB6C1" stroke="#8B4513" stroke-width="2"/>
    <rect x="30" y="50" width="40" height="12" fill="#FFD700" stroke="#8B4513" stroke-width="2"/>
    <line x1="40" y1="50" x2="40" y2="30" stroke="#FF0000" stroke-width="2"/>
    <line x1="50" y1="50" x2="50" y2="25" stroke="#FF0000" stroke-width="2"/>
    <line x1="60" y1="50" x2="60" y2="30" stroke="#FF0000" stroke-width="2"/>
    <ellipse cx="40" cy="30" rx="2" ry="4" fill="#FF4500"/>
    <ellipse cx="50" cy="25" rx="2" ry="4" fill="#FF4500"/>
    <ellipse cx="60" cy="30" rx="2" ry="4" fill="#FF4500"/>
  `,
  
  炸弹: `
    <circle cx="50" cy="55" r="25" fill="#2F4F4F" stroke="#000" stroke-width="2"/>
    <rect x="48" y="18" width="4" height="15" fill="#8B4513"/>
    <path d="M 50 18 Q 48 12 52 10 Q 54 8 52 5" fill="none" stroke="#FF4500" stroke-width="2"/>
    <text x="42" y="63" font-size="20" fill="#FFD700" font-weight="bold">💣</text>
  `,
  
  刀: `
    <rect x="42" y="55" width="8" height="30" rx="2" fill="#8B4513" stroke="#000" stroke-width="1"/>
    <path d="M 35 55 L 50 15 L 65 55 Z" fill="#C0C0C0" stroke="#000" stroke-width="2"/>
    <line x1="50" y1="20" x2="50" y2="50" stroke="#A9A9A9" stroke-width="1"/>
  `,
  
  足球: `
    <circle cx="50" cy="50" r="30" fill="#FFF" stroke="#000" stroke-width="2"/>
    <path d="M 50 30 L 55 35 L 52 42 L 48 42 L 45 35 Z" fill="#000"/>
    <path d="M 50 70 L 55 65 L 52 58 L 48 58 L 45 65 Z" fill="#000"/>
    <path d="M 30 50 L 35 45 L 42 48 L 42 52 L 35 55 Z" fill="#000"/>
    <path d="M 70 50 L 65 45 L 58 48 L 58 52 L 65 55 Z" fill="#000"/>
  `,
  
  便便: `
    <ellipse cx="50" cy="75" rx="18" ry="10" fill="#8B4513"/>
    <ellipse cx="50" cy="62" rx="16" ry="12" fill="#A0522D"/>
    <ellipse cx="50" cy="48" rx="13" ry="10" fill="#CD853F"/>
    <ellipse cx="50" cy="38" rx="10" ry="8" fill="#DEB887"/>
    <circle cx="42" cy="45" r="3" fill="#000"/>
    <circle cx="58" cy="45" r="3" fill="#000"/>
    <path d="M 45 52 Q 50 56 55 52" fill="none" stroke="#000" stroke-width="2"/>
  `,
  
  月亮: `
    <path d="M 35 50 Q 35 25 50 20 Q 40 22 35 35 Q 32 50 35 65 Q 40 78 50 80 Q 35 75 35 50 Z" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
  `,
  
  太阳: `
    <circle cx="50" cy="50" r="18" fill="#FFD700" stroke="#FFA500" stroke-width="2"/>
    <line x1="50" y1="15" x2="50" y2="25" stroke="#FFD700" stroke-width="3"/>
    <line x1="50" y1="75" x2="50" y2="85" stroke="#FFD700" stroke-width="3"/>
    <line x1="15" y1="50" x2="25" y2="50" stroke="#FFD700" stroke-width="3"/>
    <line x1="75" y1="50" x2="85" y2="50" stroke="#FFD700" stroke-width="3"/>
    <line x1="25" y1="25" x2="32" y2="32" stroke="#FFD700" stroke-width="3"/>
    <line x1="68" y1="68" x2="75" y2="75" stroke="#FFD700" stroke-width="3"/>
    <line x1="75" y1="25" x2="68" y2="32" stroke="#FFD700" stroke-width="3"/>
    <line x1="32" y1="68" x2="25" y2="75" stroke="#FFD700" stroke-width="3"/>
  `,
  
  礼物: `
    <rect x="28" y="45" width="44" height="35" fill="#FF69B4" stroke="#C71585" stroke-width="2"/>
    <rect x="25" y="40" width="50" height="8" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
    <rect x="47" y="40" width="6" height="40" fill="#FFD700" stroke="#DAA520" stroke-width="1"/>
    <path d="M 50 40 Q 40 30 40 22 Q 40 18 44 18 Q 46 18 47 20" fill="none" stroke="#FFD700" stroke-width="2"/>
    <path d="M 50 40 Q 60 30 60 22 Q 60 18 56 18 Q 54 18 53 20" fill="none" stroke="#FFD700" stroke-width="2"/>
  `,
  
  拥抱: `
    <circle cx="50" cy="45" r="30" fill="#FFD700" stroke="#000" stroke-width="2"/>
    <ellipse cx="35" cy="40" rx="4" ry="7" fill="#000"/>
    <ellipse cx="65" cy="40" rx="4" ry="7" fill="#000"/>
    <path d="M 32 55 Q 50 65 68 55" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 15 50 Q 25 45 30 50 Q 25 55 15 60" fill="#FFD700" stroke="#000" stroke-width="2"/>
    <path d="M 85 50 Q 75 45 70 50 Q 75 55 85 60" fill="#FFD700" stroke="#000" stroke-width="2"/>
  `,
  
  强: `
    <circle cx="50" cy="50" r="35" fill="#FF6347" stroke="#8B0000" stroke-width="2"/>
    <text x="32" y="65" font-size="32" fill="#FFF" font-weight="bold">强</text>
  `,
  
  弱: `
    <circle cx="50" cy="50" r="35" fill="#87CEEB" stroke="#4682B4" stroke-width="2"/>
    <text x="32" y="65" font-size="32" fill="#FFF" font-weight="bold">弱</text>
  `,
  
  握手: `
    <rect x="20" y="40" width="25" height="30" rx="5" fill="#FFD700" stroke="#000" stroke-width="2"/>
    <rect x="55" y="40" width="25" height="30" rx="5" fill="#FFD700" stroke="#000" stroke-width="2"/>
    <rect x="40" y="48" width="20" height="15" fill="#F0E68C" stroke="#000" stroke-width="1.5"/>
  `,
  
  胜利: `
    <ellipse cx="35" cy="40" rx="5" ry="8" fill="#000"/>
    <ellipse cx="65" cy="40" rx="5" ry="8" fill="#000"/>
    <path d="M 30 58 Q 50 70 70 58" fill="none" stroke="#000" stroke-width="3"/>
    <path d="M 75 30 L 75 50" stroke="#FFD700" stroke-width="4"/>
    <path d="M 85 30 L 85 45" stroke="#FFD700" stroke-width="4"/>
  `,
  
  抱拳: `
    <circle cx="50" cy="45" r="28" fill="#FFD700" stroke="#000" stroke-width="2"/>
    <ellipse cx="38" cy="42" rx="4" ry="7" fill="#000"/>
    <ellipse cx="62" cy="42" rx="4" ry="7" fill="#000"/>
    <path d="M 35 56 Q 50 64 65 56" fill="none" stroke="#000" stroke-width="2.5"/>
    <rect x="35" y="70" width="30" height="18" rx="4" fill="#F5DEB3" stroke="#000" stroke-width="2"/>
  `,
  
  拳头: `
    <rect x="35" y="35" width="30" height="35" rx="8" fill="#F5DEB3" stroke="#000" stroke-width="2"/>
    <circle cx="40" cy="42" r="5" fill="#DEB887" stroke="#000" stroke-width="1"/>
    <circle cx="50" cy="40" r="5" fill="#DEB887" stroke="#000" stroke-width="1"/>
    <circle cx="60" cy="42" r="5" fill="#DEB887" stroke="#000" stroke-width="1"/>
    <rect x="38" y="65" width="24" height="10" rx="3" fill="#D2B48C" stroke="#000" stroke-width="1"/>
  `,
  
  OK: `
    <circle cx="50" cy="50" r="35" fill="#32CD32" stroke="#228B22" stroke-width="2"/>
    <text x="28" y="68" font-size="36" fill="#FFF" font-weight="bold">OK</text>
  `,
};

// Generate all sticker files
console.log(`Generating ${Object.keys(stickers).length} stickers...`);

for (const [name, content] of Object.entries(stickers)) {
  const svg = createFaceSVG(content);
  const filename = join(STICKER_DIR, `${name}.svg`);
  writeFileSync(filename, svg, "utf-8");
}

console.log(`✓ Generated ${Object.keys(stickers).length} stickers in ${STICKER_DIR}`);
console.log("\nSticker names:");
console.log(Object.keys(stickers).join(" "));
