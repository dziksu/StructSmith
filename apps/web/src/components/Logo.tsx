import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The StructSmith mark. Same geometry as `public/logo.svg`, but the pale arc
 * uses `currentColor` so the mark stays legible on both themes; the accent arc
 * keeps the brand gradient. `pathLength="360"` lets the two arcs be positioned
 * by angle in degrees.
 */
export function Logo({ className, size = 20 }: { className?: string; size?: number }) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      role="img"
      aria-label="StructSmith"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="74" y1="10" x2="118" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0FC6F8" />
          <stop offset=".62" stopColor="#22E4CD" />
          <stop offset="1" stopColor="#00BDFB" />
        </linearGradient>
      </defs>

      <g fill="none" strokeWidth="21" strokeLinecap="round">
        <circle
          cx="64"
          cy="64"
          r="46"
          pathLength="360"
          stroke="currentColor"
          opacity="0.35"
          strokeDasharray="178 182"
          strokeDashoffset="-62"
        />
        <circle
          cx="64"
          cy="64"
          r="46"
          pathLength="360"
          stroke={`url(#${gradientId})`}
          strokeDasharray="83 277"
          strokeDashoffset="68.5"
        />
      </g>

      <circle cx="64" cy="64" r="16" fill="currentColor" opacity="0.35" />
    </svg>
  );
}
