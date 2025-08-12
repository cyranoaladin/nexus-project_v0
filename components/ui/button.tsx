import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white shadow-sm font-semibold hover:bg-blue-700 focus-visible:ring-blue-600",
        secondary: "bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100",
        accent: "bg-red-500 text-white shadow-sm font-semibold hover:bg-red-600 focus-visible:ring-red-500",
        outline: "border border-blue-600 text-blue-600 bg-transparent hover:bg-blue-600 hover:text-white",
        ghost: "text-blue-600 hover:bg-blue-50",
        link: "text-blue-600 underline-offset-4 hover:underline",
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