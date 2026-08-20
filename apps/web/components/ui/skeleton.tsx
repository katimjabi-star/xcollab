interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  /** Accessible loading label (pass t.skeletonLoading on the group's lead
      block); omitted blocks are decorative (aria-hidden). */
  label?: string;
  className?: string;
}

/** Shimmer placeholder — size it to match the final layout (no layout shift). */
export function Skeleton({ width, height = "1em", radius, label, className }: SkeletonProps) {
  const a11y = label
    ? ({ role: "status", "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);
  return (
    <span
      className={className ? `ui-skeleton ${className}` : "ui-skeleton"}
      style={{ width, height, borderRadius: radius }}
      {...a11y}
    />
  );
}
