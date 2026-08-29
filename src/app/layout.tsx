import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapQuest — 파티 포토 빙고 & 네컷 전리품",
  description:
    "AI가 각자에게 다른 사진 미션 빙고판을 깔아주고, 파티가 끝나면 그 판이 나만의 네컷 전리품이 된다.",
  applicationName: "SnapQuest",
  openGraph: {
    title: "SnapQuest — 파티 포토 빙고 & 네컷 전리품",
    description: "설치도 로그인도 없이, QR 하나로 시작하는 파티 사진 미션 게임.",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0910",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
