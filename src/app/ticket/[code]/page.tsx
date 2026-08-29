import TicketScreen from "./TicketScreen";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <TicketScreen code={code.toUpperCase()} />;
}
