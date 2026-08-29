import TvScreen from "@/components/tv/TvScreen";

export const metadata = { title: "SnapQuest TV" };

export default async function TvPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <TvScreen code={code.toUpperCase()} />;
}
