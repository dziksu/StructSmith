import { cn } from "@/lib/utils";

export function Logo({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="StructSmith"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
