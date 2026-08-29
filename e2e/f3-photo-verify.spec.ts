/**
 * F3 사진 인증 (AI 비전) — 수용 기준 1~4 + §2 비즈니스 규칙 "판정은 사진 1장당 1회".
 *
 * 판정 결과는 통제할 수 없다(1×1 픽셀을 Gemini 가 어떻게 볼지 보장이 없다).
 * 그래서 "AI 통과"와 "직접 인증" 중 어느 쪽이든 **칸이 반드시 채워지는 것**을 단언한다 —
 * 수용 기준은 판정 품질이 아니라 플로우 완주다.
 *
 * 이 파일 어디에서도 fill()/type() 을 부르지 않는다. 그게 곧 수용 기준 1(필수 타이핑 0회)이다.
 * 셀렉터는 한국어 문구가 아니라 data-status / data-testid 로 잡는다 — 이 화면의 문구는
 * 카피 튜닝으로 계속 바뀐다(실제로 이 스펙을 쓰는 동안 두 번 바뀌었다).
 */

import type { APIResponse, Page } from "@playwright/test";
import type { BoardCell, Photo } from "../src/lib/db/types";
import { expect, test } from "./fixtures";
import { admin, PIXEL_PNG, pixelFile } from "./helpers";

type PhotoResponse = { photo: Photo; verified: boolean; caption: string };

async function body<T>(res: APIResponse): Promise<T> {
  expect(res.ok(), `${res.url()} → ${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

async function photosOf(roomId: string): Promise<Photo[]> {
  const { data } = await admin()
    .from("photos")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Photo[];
}

async function boardOf(participantId: string): Promise<BoardCell[]> {
  const { data } = await admin()
    .from("participants")
    .select("board")
    .eq("id", participantId)
    .single();
  return (data?.board ?? []) as BoardCell[];
}

/** "인증 중" 상태를 확실히 관측하려고 요청만 늦춘다 — 응답은 실제 서버 것 그대로다. */
async function slowPhotoUpload(page: Page, ms = 1500): Promise<void> {
  await page.route("**/api/photo", async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

/** 결과 시트의 주 버튼. AI 통과면 "확인", 실패·불확실이면 "직접 인증하기" — 둘 다 첫 버튼이다. */
const sheetAction = (page: Page) => page.getByTestId("sheet").getByRole("button").first();

test("칸 인증: 업로드 → 인증 중 → 완료. 타이핑 0회, 캡션은 자동으로 붙는다", async ({
  page,
  room,
  guest,
}) => {
  await slowPhotoUpload(page);
  await page.goto(`/play/${room.code}`);

  const cell = page.getByTestId("cell-0");
  await expect(cell).toHaveAttribute("data-status", "todo");
  await cell.click();

  // 촬영 시트의 첫 파일 입력 = "지금 찍기". 여기서부터 완료까지 키보드를 한 번도 쓰지 않는다.
  await page.getByTestId("sheet").locator('input[type="file"]').first().setInputFiles(pixelFile());

  // 1. 판정 중
  await expect(cell).toHaveAttribute("data-status", "judging");

  // 2. 결과 시트: AI 통과 → 확인 / 실패·불확실 → 직접 인증하기. 어느 쪽이든 버튼이 뜬다.
  await expect(sheetAction(page)).toBeVisible();

  // 3. 캡션은 한 글자도 치지 않았는데 이미 저장돼 있고, 시트에 그대로 노출된다.
  const [photo] = await photosOf(room.id);
  expect(photo.cell_index).toBe(0);
  expect(photo.owner_id).toBe(guest.participant.id);
  expect(photo.caption.trim().length).toBeGreaterThan(0);
  await expect(page.getByTestId("sheet").getByText(photo.caption, { exact: true })).toBeVisible();

  const aiPassed = photo.verify_status === "ai_pass";

  // 4. 두 경로 중 무엇이 걸리든 칸은 채워진다.
  await sheetAction(page).click();
  await expect(cell).toHaveAttribute("data-status", "done");

  const board = await boardOf(guest.participant.id);
  expect(board[0].status).toBe("done");
  expect(board[0].photoId).toBe(photo.id);
  expect((await photosOf(room.id))[0].verify_status).toBe(aiPassed ? "ai_pass" : "self_check");
});

test("자유 사진: 칸을 쓰지 않고 찍은 사람 아카이브에 귀속된다", async ({
  page,
  room,
  guest,
}) => {
  await page.goto(`/play/${room.code}`);
  await expect(page.getByTestId("cell-0")).toHaveAttribute("data-status", "todo");

  await page.getByTestId("free-photo").setInputFiles(pixelFile());
  await expect(page.getByTestId("sheet")).toBeVisible(); // 결과 시트 = 업로드 완료

  const [photo] = await photosOf(room.id);
  expect(photo.cell_index).toBeNull();
  expect(photo.owner_id).toBe(guest.participant.id);
  // 자유 사진은 빙고 칸을 소비하지 않는다.
  expect((await boardOf(guest.participant.id)).every((c) => c.status === "todo")).toBe(true);

  await page.getByTestId("sheet").getByRole("button").last().click(); // 닫기
  await page.getByTestId("go-album").click();
  await page.getByTestId("album-mine").click();

  // "내 사진" 은 owner_id === me 로만 거른다(얼굴인식 없음).
  await expect(page.getByTestId("album-item")).toHaveCount(1);
  await expect(page.getByTestId("album-item").getByRole("img", { name: photo.caption })).toBeVisible();
});

test("같은 사진을 두 번 올려도 비전 판정은 한 번뿐이다 (원가 통제)", async ({
  request,
  room,
  guest,
}) => {
  const data = {
    roomCode: room.code,
    sessionToken: guest.sessionToken,
    cellIndex: 0,
    imageBase64: PIXEL_PNG,
  };

  const first = await body<PhotoResponse>(await request.post("/api/photo", { data }));
  const second = await body<PhotoResponse>(await request.post("/api/photo", { data }));

  // 같은 바이트 = 같은 사진 = 판정 1회. 두 번째는 저장된 판정을 그대로 돌려줘야 한다.
  expect(second.photo.id).toBe(first.photo.id);
  expect(second.caption).toBe(first.caption);
  expect(await photosOf(room.id)).toHaveLength(1);
});

test("직접 인증은 AI 를 재호출하지 않고 칸만 채운다", async ({ request, room, guest }) => {
  const posted = await body<PhotoResponse>(
    await request.post("/api/photo", {
      data: {
        roomCode: room.code,
        sessionToken: guest.sessionToken,
        cellIndex: 4,
        imageBase64: PIXEL_PNG,
      },
    }),
  );

  const patched = await body<{ photo: Photo }>(
    await request.patch(`/api/photo/${posted.photo.id}`, {
      data: { sessionToken: guest.sessionToken },
    }),
  );

  expect(patched.photo.verify_status).toBe("self_check");
  // 재판정이 돌았다면 캡션이 바뀐다 — 그대로여야 "재호출 없음"이다.
  expect(patched.photo.caption).toBe(posted.caption);

  const board = await boardOf(guest.participant.id);
  expect(board[4].status).toBe("done");
  expect(board[4].photoId).toBe(posted.photo.id);
});
