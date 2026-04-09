import Link from "next/link";

import { cn } from "@/lib/utils";

type CTAButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "green" | "purple" | "outline" | "ghost";
  external?: boolean;
  className?: string;
};

const variantClasses: Record<NonNullable<CTAButtonProps["variant"]>, string> = {
  green:
    "bg-gradient-to-r from-nexus-green to-nexus-green-dark text-white shadow-[0_18px_55px_rgba(16,185,129,0.25)] hover:brightness-110",
  purple:
    "bg-gradient-to-r from-nexus-purple to-nexus-purple-dark text-white shadow-[0_18px_55px_rgba(167,139,250,0.25)] hover:brightness-110",
  outline:
    "border border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10",
  ghost:
    "text-white/82 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white",
};

export default function CTAButton({
  href,
  children,
  variant = "green",
  external = false,
  className,
}: CTAButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-display font-bold tracking-[0.02em] transition-all duration-200 hover:-translate-y-0.5",
    variantClasses[variant],
    className
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
