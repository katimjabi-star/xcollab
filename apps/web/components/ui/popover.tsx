"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface PopoverProps {
  open: boolean;
  /** Called on outside pointer-down or Escape. Consumer owns the open state. */
  onClose: () => void;
  /** The trigger element — consumer keeps its own ref/aria wiring. */
  anchor: ReactNode;
  children: ReactNode;
  /** Inline edge the panel hangs from (logical, RTL-safe). */
  align?: "start" | "end";
  /** ARIA role of the panel (e.g. "menu", "dialog"). */
  role?: string;
  className?: string;
}

/** Anchored popover on a solid surface. Closes on outside pointer-down and
    Escape; on close, focus returns to the element focused at open time
    (generalizes the original user-menu pattern). */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = "end",
  role,
  className,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeRef.current();
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      /* Focus return — but never steal focus the user moved elsewhere. */
      const active = document.activeElement;
      const focusWasInside =
        active === document.body || (rootRef.current !== null && rootRef.current.contains(active));
      if (focusWasInside) restoreRef.current?.focus();
    };
  }, [open]);

  return (
    <div className={className ? `ui-popover-root ${className}` : "ui-popover-root"} ref={rootRef}>
      {anchor}
      {open && (
        <div className={`ui-popover ui-popover-${align}`} role={role}>
          {children}
        </div>
      )}
    </div>
  );
}
