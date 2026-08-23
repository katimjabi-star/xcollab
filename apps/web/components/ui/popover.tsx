"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

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

const GAP = 4;
const MARGIN = 8;

interface Placement {
  style: CSSProperties;
  side: "bottom" | "top";
  dir: "ltr" | "rtl";
}

/** Fixed coordinates for the panel: logical start/end alignment, shifted into
    the viewport horizontally, flipped above the trigger when the space below
    is too small. Fixed + portal means no ancestor overflow ever clips a menu
    and no transformed ancestor (the peek panel) re-bases it. */
function place(anchorEl: HTMLElement, panel: HTMLElement, align: "start" | "end"): Placement {
  const a = anchorEl.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  const dir = getComputedStyle(anchorEl).direction === "rtl" ? "rtl" : "ltr";
  // Logical alignment: start = leading edges flush, end = trailing edges flush.
  const leading = (align === "start") !== (dir === "rtl");
  let left = leading ? a.left : a.right - p.width;
  left = Math.min(Math.max(left, MARGIN), window.innerWidth - p.width - MARGIN);
  const spaceBelow = window.innerHeight - a.bottom - GAP - MARGIN;
  const spaceAbove = a.top - GAP - MARGIN;
  const maxHeight = Math.max(Math.max(spaceBelow, spaceAbove), 120);
  let side: "bottom" | "top" = "bottom";
  let top = a.bottom + GAP;
  if (p.height > spaceBelow && spaceAbove > spaceBelow) {
    side = "top";
    top = Math.max(a.top - GAP - Math.min(p.height, maxHeight), MARGIN);
  }
  return { style: { top, left, maxHeight }, side, dir };
}

/** Anchored popover rendered on a viewport-fixed portal layer. Closes on
    outside pointer-down and Escape; on close, focus returns to the element
    focused at open time. */
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
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const position = useCallback(() => {
    if (rootRef.current && panelRef.current) {
      setPlacement(place(rootRef.current, panelRef.current, align));
    }
  }, [align]);

  // Measure after the (hidden) first paint, then on any scroll/resize while open.
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    position();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inTrigger = rootRef.current?.contains(target) ?? false;
      const inPanel = panelRef.current?.contains(target) ?? false;
      if (!inTrigger && !inPanel) closeRef.current();
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
        active === document.body ||
        (rootRef.current !== null && rootRef.current.contains(active)) ||
        (panelRef.current !== null && panelRef.current.contains(active));
      if (focusWasInside) restoreRef.current?.focus();
    };
  }, [open]);

  const panel = open ? (
    <div
      ref={panelRef}
      role={role}
      dir={placement?.dir}
      className={`ui-popover ui-popover-${align} ui-popover-side-${placement?.side ?? "bottom"}`}
      style={{
        position: "fixed",
        visibility: placement ? "visible" : "hidden",
        ...(placement?.style ?? { top: 0, left: 0 }),
      }}
    >
      {children}
    </div>
  ) : null;

  return (
    <div className={className ? `ui-popover-root ${className}` : "ui-popover-root"} ref={rootRef}>
      {anchor}
      {panel !== null && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
