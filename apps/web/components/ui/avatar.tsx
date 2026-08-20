interface AvatarProps {
  /** Display name the initials derive from (first letter of the first two words). */
  name: string;
  /** Square edge in px; 20 is the standard row/card avatar. */
  size?: number;
  /** Tooltip + accessible label — pass the full name; defaults to `name`. */
  title?: string;
  className?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** 20px tinted initials avatar (--avatar-bg/--avatar-fg), shared by board
    cards, the task panel, and program list rows. Non-default sizes scale the
    glyph proportionally. */
export function Avatar({ name, size = 20, title, className }: AvatarProps) {
  const label = title ?? name;
  return (
    <span
      className={className ? `ui-avatar ${className}` : "ui-avatar"}
      style={
        size === 20
          ? undefined
          : { inlineSize: size, blockSize: size, fontSize: Math.round(size * 0.45) }
      }
      title={label}
      aria-label={label}
    >
      {initials(name)}
    </span>
  );
}
