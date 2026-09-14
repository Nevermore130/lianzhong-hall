import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import "./make-audio";
import { videoWebpack } from "./webpack";
import { captions, DURATION, FPS, FRAMES } from "../src/story";
const project = path.resolve(import.meta.dirname, "..");
const output = path.resolve(project, "../../artifacts/xiaohongshu-remotion");
await fs.mkdir(output, { recursive: true });
await ensureBrowser({ logLevel: "info" });
const serveUrl = await bundle({
  entryPoint: path.join(project, "src/index.tsx"),
  publicDir: path.join(project, ".generated/public"),
  webpackOverride: videoWebpack,
  onProgress: (p) => {
    if (p === 100) console.log("Remotion bundle ready.");
  },
});
const composition = await selectComposition({
  serveUrl,
  id: "InteractionPromo",
});
if (process.argv.includes("--stills")) {
  for (const frame of [45, 120, 186, 376, 603, 627, 660, 795, 840, 866, 999]) {
    await renderStill({
      serveUrl,
      composition,
      frame,
      output: path.join(output, `frame-${frame}.png`),
      imageFormat: "png",
      timeoutInMilliseconds: 90000,
    });
    console.log("Preview frame " + frame);
  }
} else {
  let reported = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: 18,
    pixelFormat: "yuv420p",
    audioCodec: "aac",
    audioBitrate: "192k",
    sampleRate: 48000,
    concurrency: 3,
    timeoutInMilliseconds: 90000,
    outputLocation: path.join(output, "复古棋牌大厅-交互演示-Remotion.mp4"),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== reported) {
        console.log(`Rendering ${pct}%`);
        reported = pct;
      }
    },
  });
  await renderStill({
    serveUrl,
    composition,
    frame: 840,
    output: path.join(output, "封面.jpg"),
    imageFormat: "jpeg",
    timeoutInMilliseconds: 90000,
  });
  const stamp = (time: number) =>
    new Date(Math.round(time * 1000))
      .toISOString()
      .slice(11, 23)
      .replace(".", ",");
  await fs.writeFile(
    path.join(output, "字幕.srt"),
    captions
      .map(
        (c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}\n`,
      )
      .join("\n"),
  );
  await fs.writeFile(
    path.join(output, "render-info.json"),
    JSON.stringify(
      {
        composition: composition.id,
        width: composition.width,
        height: composition.height,
        fps: FPS,
        frames: FRAMES,
        duration: DURATION,
        codec: "h264",
        audio: "aac",
        source:
          "Original project UI with deterministic legal game-state replay",
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Saved " + output);
}
