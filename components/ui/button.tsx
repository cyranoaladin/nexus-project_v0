import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand-primary text-white shadow-sm font-semibold hover:bg-brand-primary/90 focus-visible:ring-brand-primary",
        secondary: "bg-brand-primary/10 text-brand-primary font-semibold hover:bg-brand-primary/20",
        accent: "bg-brand-secondary text-white shadow-sm font-semibold hover:bg-brand-secondary/90 focus-visible:ring-brand-secondary",
        outline: "border border-brand-primary text-brand-primary bg-transparent hover:bg-brand-primary hover:text-white",
        ghost: "text-brand-primary hover:bg-brand-primary/10",
        link: "text-brand-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 md:h-12 px-4 md:px-6 py-2 md:py-3 text-sm md:text-base",
        sm: "h-8 md:h-9 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm",
        lg: "h-12 md:h-14 px-6 md:px-8 py-3 md:py-4 text-base md:text-lg",
        icon: "h-8 w-8 md:h-10 md:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }