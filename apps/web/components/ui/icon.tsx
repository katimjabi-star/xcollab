import type { LucideIcon } from "lucide-react";

interface IconProps {
  icon: LucideIcon;
  /** 16px UI default; 20px for emphasis contexts. */
  size?: number;
  /** Marks glyphs that must mirror in RTL (chevrons, panel arrows). */
  directional?: boolean;
  className?: string;
}

/** Single icon entry point: lucide, 16px, strokeWidth 1.75, currentColor. */
export function Icon({ icon: Glyph, size = 16, directional = false, className }: IconProps) {
  const classes = ["icon", directional ? "icon-directional" : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Glyph size={size} strokeWidth={1.75} color="currentColor" className={classes} aria-hidden />
  );
}
