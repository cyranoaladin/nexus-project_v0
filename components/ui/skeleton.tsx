/**
 * Skeleton Component - Loading Placeholder
 *
 * Provides animated loading placeholders while content loads
 * Improves perceived performance and user experience
 *
 * Usage:
 * ```tsx
 * <div className="flex items-center space-x-4">
 *   <Skeleton className="h-12 w-12 rounded-full" />
 *   <div className="space-y-2">
 *     <Skeleton className="h-4 w-[250px]" />
 *     <Skeleton className="h-4 w-[200px]" />
 *   </div>
 * </div>
 * ```
 */

import * as React from "react"
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Animation variant
   * - pulse: Subtle pulsing animation (default)
   * - wave: Wave/shimmer animation
   * - none: No animation
   */
  animation?: "pulse" | "wave" | "none"
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, animation = "pulse", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md bg-neutral-200",
          {
            "animate-pulse": animation === "pulse",
            "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent":
              animation === "wave",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Skeleton.displayName = "Skeleton"

/**
 * Pre-built skeleton patterns for common use cases
 */
const SkeletonText = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { lines?: number }
>(({ className, lines = 3, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn("h-4", i === lines - 1 && "w-4/5")}
      />
    ))}
  </div>
))
SkeletonText.displayName = "SkeletonText"

const SkeletonCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-lg border border-neutral-200 p-6", className)}
    {...props}
  >
    <div className="space-y-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  </div>
))
SkeletonCard.displayName = "SkeletonCard"

const SkeletonAvatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" | "lg" }
>(({ className, size = "md", ...props }, ref) => (
  <Skeleton
    ref={ref}
    className={cn(
      "rounded-full",
      {
        "h-8 w-8": size === "sm",
        "h-12 w-12": size === "md",
        "h-16 w-16": size === "lg",
      },
      className
    )}
    {...props}
  />
))
SkeletonAvatar.displayName = "SkeletonAvatar"

export { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar }
