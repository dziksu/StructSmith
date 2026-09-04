import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
}

export function NodeContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[190px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <div key={item.label}>
          {item.separatorBefore && index > 0 && <div className="-mx-1 my-1 h-px bg-border" />}
          <button
            type="button"
            className={cn(
              "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-accent",
              item.destructive && "text-destructive hover:bg-destructive/10",
            )}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
