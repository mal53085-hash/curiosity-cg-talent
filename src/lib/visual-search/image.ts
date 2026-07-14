import { createHash } from "node:crypto";
import sharp from "sharp";

export const MAX_VISUAL_IMAGE_BYTES = 8 * 1024 * 1024;
const signatures = [
  { mime: "image/jpeg", match: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", match: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  { mime: "image/webp", match: (b: Buffer) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
] as const;

export async function sanitizeVisualImage(input: ArrayBuffer) {
  const original = Buffer.from(input);
  if (!original.length || original.length > MAX_VISUAL_IMAGE_BYTES) throw new Error("IMAGE_SIZE_INVALID");
  const detected = signatures.find((item) => item.match(original));
  if (!detected) throw new Error("IMAGE_FORMAT_INVALID");
  try {
    const instance = sharp(original, { failOn: "error", limitInputPixels: 40_000_000 });
    const metadata = await instance.metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error();
    const output = await instance.rotate().webp({ quality: 90, effort: 4 }).toBuffer();
    return { buffer: output, mime: "image/webp" as const, width: metadata.width, height: metadata.height, sha256: createHash("sha256").update(output).digest("hex") };
  } catch { throw new Error("IMAGE_DECODE_INVALID"); }
}
