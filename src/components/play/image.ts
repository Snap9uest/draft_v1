"use client";

/**
 * 폰 사진은 HEIC·4000px·10MB 가 기본이라 그대로 올리면 API 한도에 걸린다.
 * 브라우저가 이미 디코딩할 수 있는 형식(iOS 사파리는 HEIC 포함)을 canvas 로
 * 다시 그려 JPEG 로 통일한 뒤 data URI 로 보낸다.
 */
export async function fileToJpegDataUrl(
  file: File,
  max = 1280,
  quality = 0.85,
): Promise<string> {
  const src = await decode(file);
  const scale = Math.min(1, max / Math.max(src.width, src.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(src.width * scale));
  canvas.height = Math.max(1, Math.round(src.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서는 사진을 처리할 수 없어요.");
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ("close" in src) src.close();

  const out = canvas.toDataURL("image/jpeg", quality);
  if (!out.startsWith("data:image/jpeg")) {
    throw new Error("사진을 변환하지 못했어요. 다른 사진으로 시도해 주세요.");
  }
  return out;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    // 구형 사파리 등 createImageBitmap(File) 미지원 경로
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("이 형식의 사진은 열 수 없어요. 다른 사진을 골라 주세요."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
