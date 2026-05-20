import Image from "next/image";
import { cn } from "@/lib/utils";

type LandingIllustrationProps = {
  src: string;
  alt: string;
  priority?: boolean;
  aspect?: "16/9" | "4/3" | "3/2" | "1/1";
  variant?: "light" | "dark" | "card";
  overlay?: boolean;
  className?: string;
  sizes?: string;
};

const aspectClasses: Record<NonNullable<LandingIllustrationProps["aspect"]>, string> = {
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "1/1": "aspect-square",
};

const variantClasses: Record<NonNullable<LandingIllustrationProps["variant"]>, string> = {
  light: "border-slate-200 bg-slate-50 shadow-xl shadow-slate-200/60",
  dark: "border-white/10 bg-white/5 shadow-xl shadow-black/20",
  card: "border-white bg-white shadow-2xl shadow-slate-200/80",
};

export default function LandingIllustration({
  src,
  alt,
  priority = false,
  aspect = "3/2",
  variant = "light",
  overlay = false,
  className,
  sizes = "(min-width: 1024px) 44vw, 100vw",
}: LandingIllustrationProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border",
        aspectClasses[aspect],
        variantClasses[variant],
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover"
        priority={priority}
      />
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f2f57]/55 via-transparent to-transparent" />
      )}
    </div>
  );
}
