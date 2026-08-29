"use client";

/**
 * F3 업로드용 클라이언트 리사이즈. 폰 사진은 HEIC·4000px·10MB 가 기본이라
 * 그대로 올리면 API 한도에 걸린다. 긴 변 상한까지 줄이고 JPEG 로 통일한다.
 *
 * 상한은 `src/lib/canvas/constants.ts` 에서 가져온다 — 티켓 셀 규격을 바꿨을 때
 * 업로드 규격이 따라오지 않는 사고를 막기 위해 같은 상수 파일을 참조한다(㉑).
 */

import {
  MAX_UPLOAD_CHARS,
  UPLOAD_MAX_LONG_EDGE,
  UPLOAD_MIN_LONG_EDGE,
} from "../canvas/constants";

export interface ResizedImage {
  /** `POST /api/photo` 의 imageBase64 로 그대로 보낼 수 있는 data URI */
  dataUrl: string;
  width: number;
  height: number;
  /** 디코딩 실패로 원본을 그대로 보내는 폴백 경로면 true */
  fallback: boolean;
}

/** 화질을 낮춰가며 전송 한도 안으로 넣는다. */
const QUALITY_STEPS = [0.85, 0.7, 0.55];

export async function resizeForUpload(
  file: File,
  maxEdge = UPLOAD_MAX_LONG_EDGE,
): Promise<ResizedImage> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("빈 파일이에요. 다른 사진을 골라 주세요.");
  }
  // iOS 는 HEIC 에 빈 type 을 주는 경우가 있어 빈 값은 통과시킨다.
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 올릴 수 있어요.");
  }

  // 티켓 셀에서 뭉개지는 걸 막는 하한. 호출자가 더 작게 넘겨도 여기서 올린다.
  const edge = Math.max(UPLOAD_MIN_LONG_EDGE, Math.round(maxEdge) || 0);

  const url = URL.createObjectURL(file);
  try {
    // ponytail: EXIF orientation 보정은 브라우저의 image-orientation:from-image
    // 기본값(Chrome 81+/Safari 13.4+/FF 77+)에 맡긴다. createImageBitmap 은 이
    // 기본값을 적용하지 않아 아이폰 세로 사진이 눕기 때문에 쓰지 않는다.
    // 그 이전 브라우저까지 필요해지면 EXIF 태그 직접 파싱으로 올린다.
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) throw new Error("empty bitmap");

    const scale = Math.min(1, edge / Math.max(iw, ih));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(iw * scale));
    canvas.height = Math.max(1, Math.round(ih * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const q of QUALITY_STEPS) {
      // 여기 toDataURL 은 API 전송용 base64 다. 다운로드 링크에는 절대 쓰지 않는다.
      const dataUrl = canvas.toDataURL("image/jpeg", q);
      if (!dataUrl.startsWith("data:image/jpeg")) break;
      if (dataUrl.length <= MAX_UPLOAD_CHARS) {
        return { dataUrl, width: canvas.width, height: canvas.height, fallback: false };
      }
    }
    throw new Error("too large");
  } catch {
    // HEIC 등 브라우저가 못 여는 형식은 원본 그대로 서버에 넘긴다.
    return readAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readAsDataUrl(file: File): Promise<ResizedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(new Error("사진을 읽지 못했어요. 다른 사진으로 시도해 주세요."));
    reader.readAsDataURL(file);
  });
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("이 형식의 사진은 올릴 수 없어요. 다른 사진을 골라 주세요.");
  }
  if (dataUrl.length > MAX_UPLOAD_CHARS) {
    throw new Error("사진 용량이 너무 커요. 더 작은 사진으로 올려 주세요.");
  }
  return { dataUrl, width: 0, height: 0, fallback: true };
}
