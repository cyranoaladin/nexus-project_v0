"use client";

import { track } from "@/lib/analytics";
import CTAButton from "@/components/sections/homepage/CTAButton";

type TrackedCTAButtonProps = React.ComponentProps<typeof CTAButton> & {
  /** Analytics location identifier, e.g. "hero", "finish", "select" */
  trackingLocation: string;
};

export default function TrackedCTAButton({
  trackingLocation,
  children,
  ...props
}: TrackedCTAButtonProps) {
  return (
    <span
      onClick={() => {
        track.ctaClick(trackingLocation, props.href);
      }}
    >
      <CTAButton {...props}>{children}</CTAButton>
    </span>
  );
}
