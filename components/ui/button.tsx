import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, useReducedMotion } from "framer-motion"
import { Loader2 } from "lucide-react"
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
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()
    const isDisabled = disabled || loading

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          aria-busy={loading}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    const MotionButton = motion.button

    return (
      // @ts-expect-error - framer-motion v11 type conflict with React 19 onDrag prop
      <MotionButton
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        whileHover={prefersReducedMotion || isDisabled ? undefined : { scale: 1.02 }}
        whileTap={prefersReducedMotion || isDisabled ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.2 }}
        {...props}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {children}
      </MotionButton>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }