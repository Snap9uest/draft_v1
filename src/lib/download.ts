"use client";

/**
 * 이미지 저장 경로는 이 함수 **하나**만 존재한다.
 *
 * 티어다운 ⑳ — Picapica 는 스트립/GIF 두 경로가 갈려서 한쪽만 appendChild·revoke 를
 * 해서 메모리 누수 + 일부 브라우저 무동작을 냈다. 헬퍼를 안 뽑아서 생긴 드리프트다.
 *
 * `toDataURL` 금지: iOS Safari 가 거대한 data: URL 의 download 속성을 무시한다.
 * (Picapica 가 실제로 겪고 toBlob 으로 마이그레이션한 흔적이 소스맵에 남아 있다.)
 */

export type SaveResult = "shared" | "downloaded" | "cancelled";

export async function saveImage(
  source: Blob | HTMLCanvasElement,
  filename = "snapquest.jpg",
): Promise<SaveResult> {
  const blob = source instanceof Blob ? source : await canvasToBlob(source);
  if (!blob.size) throw new Error("저장할 이미지가 비어 있어요.");
  const name = safeName(filename);

  // 파티 결과물은 공유가 목적이므로 공유 시트가 1순위 버튼이다.
  const file = new File([blob], name, { type: blob.type || "image/jpeg" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "SnapQuest 티켓" });
      return "shared";
    } catch (e) {
      // 사용자가 시트를 닫은 것뿐이면 다운로드로 밀어붙이지 않는다.
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a); // Firefox 등은 문서에 붙어야 click 이 먹는다
  a.click();
  a.remove();
  // 즉시 revoke 하면 다운로드가 시작되기 전에 URL 이 끊긴다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요."))),
      "image/jpeg",
      0.92,
    );
  });
}

/** 방 이름·닉네임이 파일명에 섞여 들어온다 — 경로 구분자와 제어문자를 막는다. */
function safeName(name: string): string {
  const base = (typeof name === "string" ? name : "")
    .replace(/[^\w.가-힣-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 80);
  return base && /\.[a-z]{3,4}$/i.test(base) ? base : `${base || "snapquest"}.jpg`;
}
