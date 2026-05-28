import Link from "next/link";
import { cn } from "@/lib/utils";

type CTAButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "stage" | "stage-outline" | "eaf" | "eaf-outline" | "eaf-dark-outline";
  className?: string;
  fullWidth?: boolean;
};

const variantClasses: Record<NonNullable<CTAButtonProps["variant"]>, string> = {
  stage:
    "border border-[#b91c1c]/20 bg-white text-[#9f1239] shadow-sm hover:border-[#b91c1c]/35 hover:bg-[#fff1f2]",
  "stage-outline":
    "border border-[#b91c1c]/25 bg-transparent text-[#9f1239] hover:bg-[#fff1f2]",
  eaf:
    "border border-[#0f3d73] bg-[#0f3d73] text-white shadow-sm hover:bg-[#0b2f59]",
  "eaf-outline":
    "border border-[#0f3d73]/30 bg-white text-[#0f3d73] shadow-sm hover:bg-[#eff6ff]",
  "eaf-dark-outline":
    "border border-white/30 bg-transparent text-white shadow-sm hover:bg-white/10",
};

export default function CTAButton({
  href,
  children,
  variant = "stage",
  className,
  fullWidth = false,
}: CTAButtonProps) {
  const classes = cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-display font-bold tracking-tight transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d73] focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:py-3",
    fullWidth && "w-full",
    variantClasses[variant],
    className
  );

  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
