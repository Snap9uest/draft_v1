import type { ComponentProps, ReactNode } from "react";

const VARIANTS = {
  /** 검정 알약. 화면당 하나. */
  primary: "bg-primary text-on-primary hover:opacity-90",
  /** 진한 핑크. primary 와 나란히 둘 때만. */
  secondary: "bg-secondary text-on-secondary hover:opacity-90",
  /** 테두리만. 부수적인 동작. */
  ghost: "border border-hairline text-ink hover:bg-surface-soft active:bg-surface-variant",
} as const;

// min-h-12(48px) 로 터치 타깃 44px 하한을 넘긴다. 줄이지 말 것.
// active:scale 은 점토를 눌렀다 떼는 느낌 — DESIGN.md 의 "squishy press".
// whitespace-nowrap: a button sharing a row with a text field gets squeezed,
// and a label broken across two lines inside a pill reads as a layout bug.
const BASE =
  "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-base font-semibold " +
  "transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

type Variant = keyof typeof VARIANTS;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "ghost",
  className = "",
  ...props
}: ComponentProps<"a"> & { variant?: Variant }) {
  return <a className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function Card({
  className = "",
  children,
  accentColor,
}: {
  className?: string;
  children: ReactNode;
  /**
   * 카드 상단 컬러 스트립. CSS 색 문자열을 그대로 받는다.
   * 예: accentColor="var(--color-brand-peach)" 또는 "#ffb084".
   * 생략하면 스트립 없는 민 카드.
   */
  accentColor?: string;
}) {
  return (
    <div
      className={`relative rounded-3xl bg-card p-5 shadow-clay ${
        accentColor ? "overflow-hidden" : ""
      } ${className}`}
    >
      {accentColor && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-2"
          style={{ background: accentColor }}
        />
      )}
      {children}
    </div>
  );
}

/**
 * 픽셀 폰트 워드마크. 영문 전용 — 한글과 같은 줄에 섞지 말 것.
 * 크기는 className 으로. 픽셀 폰트는 같은 font-size 에서 훨씬 커 보여서
 * 본문보다 두 단계쯤 작게 잡는 게 맞다 (nav 는 text-xs, 히어로는 text-3xl 정도).
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-pixel text-ink ${className}`} translate="no">
      SnapQuest
    </span>
  );
}
