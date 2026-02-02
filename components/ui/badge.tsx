import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 md:px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-primary/10 text-brand-primary text-xs md:text-sm font-medium px-2 md:px-3 py-0.5 md:py-1 rounded-full",
        popular: "border-transparent bg-brand-secondary/10 text-brand-secondary text-xs md:text-sm font-medium px-2 md:px-3 py-0.5 md:py-1 rounded-full",
        outline: "border-brand-primary text-brand-primary",
        success: "border-transparent bg-success text-white shadow hover:bg-success/90",
        warning: "border-transparent bg-warning text-white shadow hover:bg-warning/90",
        destructive: "border-transparent bg-error text-white shadow hover:bg-error/90",
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