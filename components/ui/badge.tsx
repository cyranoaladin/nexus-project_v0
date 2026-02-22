import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 md:px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-primary/15 text-brand-primary text-xs md:text-sm font-medium px-2 md:px-3 py-0.5 md:py-1 rounded-full",
        popular: "border-transparent bg-brand-secondary/20 text-neutral-100 text-xs md:text-sm font-medium px-2 md:px-3 py-0.5 md:py-1 rounded-full",
        outline: "border-white/25 text-neutral-200",
        success: "border-success/35 bg-success/15 text-emerald-300",
        warning: "border-warning/35 bg-warning/15 text-slate-200",
        destructive: "border-error/35 bg-error/15 text-slate-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
