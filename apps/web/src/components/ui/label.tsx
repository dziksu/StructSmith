import * as LabelPrimitive from "@radix-ui/react-label";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
