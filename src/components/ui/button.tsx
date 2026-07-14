import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "border-accent bg-accent text-white hover:bg-[#3a3a36]",
  secondary: "border-line bg-surface text-foreground hover:bg-surface-muted",
  danger: "border-[#d8b8b4] bg-surface text-danger hover:bg-[#f5e9e7]",
  ghost: "border-transparent bg-transparent text-muted hover:bg-surface-muted hover:text-foreground",
} as const;

export function buttonStyles(
  variant: keyof typeof variants = "primary",
  className?: string,
) {
  return cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={buttonStyles(variant, className)} {...props} />;
}
