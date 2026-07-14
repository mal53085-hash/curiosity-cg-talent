import Link from "next/link";
import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/button";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonStyles(variant, className)}>
      {children}
    </Link>
  );
}
