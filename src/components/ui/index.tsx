import type { ComponentProps, ReactNode } from "react";

const VARIANTS = {
  primary: "bg-accent text-black hover:brightness-95 active:brightness-90",
  ghost: "border border-white/15 text-white hover:bg-white/10 active:bg-white/15",
} as const;

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold " +
  "transition disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-5 ${className}`}>
      {children}
    </div>
  );
}
