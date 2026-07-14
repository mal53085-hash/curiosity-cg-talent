const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_IMAGE_BYTES = 3_500_000;
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

function matchesSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (mime === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("IMAGE_ENCODE_INVALID")), "image/webp", quality));
}

export async function prepareVisualReference(file: File) {
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error("1画像は8MB以下にしてください。");
  if (!allowed.has(file.type)) throw new Error("JPEG、PNG、WebPのみ使用できます。SVGは使用できません。");
  const source = await file.arrayBuffer();
  if (!matchesSignature(new Uint8Array(source, 0, Math.min(12, source.byteLength)), file.type)) throw new Error("画像形式とファイル内容が一致しません。");
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(new Blob([source], { type: file.type }));
    let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    let result: Blob | undefined;
    for (const quality of [0.88, 0.78, 0.68, 0.58]) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("IMAGE_DECODE_INVALID");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      result = await toBlob(canvas, quality);
      canvas.width = 1; canvas.height = 1;
      if (result.type === "image/webp" && result.size <= MAX_REQUEST_IMAGE_BYTES) return result;
      scale *= 0.78;
    }
    throw new Error("画像を安全な解析サイズへ変換できませんでした。");
  } catch (error) {
    if (error instanceof Error && error.message.includes("画像")) throw error;
    throw new Error("画像を安全にデコードできませんでした。");
  } finally {
    bitmap?.close();
    new Uint8Array(source).fill(0);
  }
}
