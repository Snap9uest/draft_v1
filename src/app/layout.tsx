import type { Metadata, Viewport } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";

// 본문. 한글 글리프는 없어서 globals.css 의 --font-sans 뒤 스택으로 폴백된다.
const body = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

// 로고·영문 라벨 전용 픽셀 폰트. latin 만, 한 웨이트만.
const pixel = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "SnapQuest · 파티 포토 빙고와 네컷 전리품",
  description:
    "AI가 각자에게 다른 사진 미션 빙고판을 깔아주고, 파티가 끝나면 그 판이 나만의 네컷 전리품이 된다.",
  applicationName: "SnapQuest",
  openGraph: {
    title: "SnapQuest · 파티 포토 빙고와 네컷 전리품",
    description: "설치도 로그인도 없이, QR 하나로 시작하는 파티 사진 미션 게임.",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fef9ef",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${body.variable} ${pixel.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface text-ink">
        {children}
      </body>
    </html>
  );
}
