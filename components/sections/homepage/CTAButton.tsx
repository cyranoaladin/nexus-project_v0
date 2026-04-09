import Link from "next/link";
import { cn } from "@/lib/utils";

type CTAButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "stage" | "stage-outline" | "eaf" | "eaf-outline";
  className?: string;
  fullWidth?: boolean;
};

const variantClasses: Record<NonNullable<CTAButtonProps["variant"]>, string> = {
  stage:
    "bg-gradient-to-r from-nexus-green to-nexus-green-dark text-white border border-nexus-green/60 hover:shadow-lg hover:shadow-nexus-green/20",
  "stage-outline":
    "border border-nexus-green/50 text-nexus-green bg-transparent hover:bg-nexus-green/10",
  eaf:
    "bg-gradient-to-r from-nexus-purple to-nexus-purple-dark text-white border border-nexus-purple/60 hover:shadow-lg hover:shadow-nexus-purple/20",
  "eaf-outline":
    "border border-nexus-purple/50 text-nexus-purple bg-transparent hover:bg-nexus-purple/10",
};

export default function CTAButton({
  href,
  children,
  variant = "stage",
  className,
  fullWidth = false,
}: CTAButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-display font-bold tracking-tight transition-all duration-200 hover:-translate-y-0.5",
    fullWidth && "w-full",
    variantClasses[variant],
    className
  );

  if (href.startsWith("/")) {
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
