import fs from "node:fs/promises";
import path from "node:path";
import { cues, DURATION } from "../src/story";
const rate = 48000,
  samples = new Float64Array(rate * DURATION);
function note(
  at: number,
  len: number,
  midi: number,
  gain: number,
  click = false,
) {
  const f = 440 * 2 ** ((midi - 69) / 12),
    start = Math.round(at * rate);
  for (let i = 0; i < len * rate && i + start < samples.length; i++) {
    const t = i / rate,
      env = click
        ? Math.exp(-t * 80)
        : Math.min(1, t / 0.015) * Math.min(1, (len - t) / 0.12);
    samples[start + i] +=
      gain *
      env *
      (Math.sin(2 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t));
  }
}
// A quiet original loop; interface feedback sits in front of the music.
const chords = [
  [48, 52, 55, 59],
  [45, 48, 52, 55],
  [41, 45, 48, 52],
  [43, 47, 50, 55],
];
for (let i = 0; i < 108; i++) {
  const c = chords[Math.floor(i / 16) % 4],
    at = i * 0.3125;
  note(at, 0.25, c[i % 4] + 12, 0.016);
  if (i % 4 === 0) note(at, 0.9, c[0] - 12, 0.03);
}
for (const cue of cues.filter((c) => c.click)) {
  note(cue.at, 0.045, 87, 0.25, true);
  note(cue.at + 0.017, 0.03, 63, 0.14, true);
}
for (const at of [
  5.2, 5.9, 6.6, 7.3, 8, 8.7, 13.1, 14.1, 15.65, 16.3, 18.8, 21.6, 22.4, 26.2,
  27.65, 29.1, 29.9, 30.7,
]) {
  note(at, 0.08, 60, 0.12, true);
  note(at + 0.014, 0.07, 53, 0.08, true);
}
const wav = Buffer.alloc(44 + samples.length * 4);
wav.write("RIFF", 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(samples.length * 4, 40);
for (let i = 0; i < samples.length; i++) {
  const t = i / rate,
    fade = Math.min(1, t / 0.1, (DURATION - t) / 0.7),
    v = Math.round(
      Math.max(-0.96, Math.min(0.96, samples[i] * fade * 3.2)) * 32767,
    );
  wav.writeInt16LE(v, 44 + i * 4);
  wav.writeInt16LE(v, 46 + i * 4);
}
const dest = path.resolve(
  import.meta.dirname,
  "../.generated/public/promo-audio/interaction.wav",
);
await fs.mkdir(path.dirname(dest), { recursive: true });
await fs.writeFile(dest, wav);
console.log("Original interaction soundtrack prepared.");
