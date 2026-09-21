#!/usr/bin/env node
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";

const sourceDir = new URL("../public/assets/lobby-v1/", import.meta.url);
const targetDir = new URL("../public/assets/lobby-v2/", import.meta.url);

// Target max dimension and quality for optimized WebPs
const MAX_SIZE = 512;
const QUALITY = 80;

const imageFiles = [
  "table.webp",
  "chair-far.webp",
  "chair-near.webp",
  "player-near.webp",
  "player-far.webp",
];

console.log("🖼️  Optimizing lobby images...\n");

// Create target directory
await mkdir(targetDir, { recursive: true });

let totalOriginal = 0;
let totalOptimized = 0;

// Process each image
for (const file of imageFiles) {
  const sourcePath = new URL(file, sourceDir);
  const targetPath = new URL(file, targetDir);

  // Get original file size
  const originalBuffer = await readFile(sourcePath);
  const originalSize = originalBuffer.length;
  totalOriginal += originalSize;

  // Get original dimensions (convert URL to file path string)
  const metadata = await sharp(originalBuffer).metadata();
  console.log(
    `  ${file}: ${metadata.width}×${metadata.height} → ${(originalSize / 1024).toFixed(1)}KB`,
  );

  // Resize and optimize
  await sharp(originalBuffer)
    .resize(MAX_SIZE, MAX_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY, alphaQuality: 85 })
    .toFile(new URL(file, targetDir).pathname);

  // Get optimized file size
  const optimizedBuffer = await readFile(targetPath);
  const optimizedSize = optimizedBuffer.length;
  totalOptimized += optimizedSize;

  const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
  console.log(
    `     ✓ Optimized to ${MAX_SIZE}px max → ${(optimizedSize / 1024).toFixed(1)}KB (${savings}% smaller)\n`,
  );
}

// Copy manifest.json to v2 and update version
const manifestPath = new URL("manifest.json", sourceDir);
const targetManifestPath = new URL("manifest.json", targetDir);
const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
manifest.version = 2;
manifest.source = "assets/source/lobby-v1/PROMPTS.md";
manifest.rebuild = "node scripts/build-lobby-assets.mjs";
await writeFile(targetManifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`📊 Total size reduction:`);
console.log(`   Before: ${(totalOriginal / 1024).toFixed(1)}KB`);
console.log(`   After:  ${(totalOptimized / 1024).toFixed(1)}KB`);
console.log(
  `   Saved:  ${((totalOriginal - totalOptimized) / 1024).toFixed(1)}KB (${((1 - totalOptimized / totalOriginal) * 100).toFixed(1)}% reduction)\n`,
);

console.log("✅ Lobby assets optimized successfully!");
console.log(
  `   New assets are in: public/assets/lobby-v2/\n   Update imports to use lobby-v2 instead of lobby-v1.`,
);
