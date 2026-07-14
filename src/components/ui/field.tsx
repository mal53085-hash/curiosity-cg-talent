import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-[#55544f]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-5 text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const fieldControlClass =
  "min-h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-[#a4a39d] focus:border-[#aaa9a1] focus:ring-2 focus:ring-foreground/5";
