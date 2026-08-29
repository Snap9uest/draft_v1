import PlayScreen from "@/components/play/PlayScreen";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const invite = query.invite;
  return (
    <PlayScreen
      code={code.toUpperCase()}
      invitedBy={typeof invite === "string" ? invite : undefined}
      initialTab={query.tab === "album" ? "album" : "board"}
    />
  );
}
