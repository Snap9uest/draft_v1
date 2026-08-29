import { redirect } from "next/navigation";

/** 앨범은 /play/[code] 안의 탭이다. 외부에 공유된 /album 링크만 흡수한다. */
export default async function AlbumPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/play/${code}?tab=album`);
}
