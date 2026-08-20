import type { ReactNode } from "react";

type ChipStatus = "todo" | "in_progress" | "done" | "blocked";

interface ChipProps {
  variant: "status" | "dueDate";
  /** Required when variant is "status" — picks the semantic tint pair. */
  status?: ChipStatus;
  /** dueDate variant only: swaps the neutral tint for the overdue pair. */
  overdue?: boolean;
  /** Optional leading 12-16px icon (already sized by the caller). */
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
}

/** 20px-tall tinted chip: 10-15% tint background + full-strength text. */
export function Chip({ variant, status, overdue = false, icon, children, title }: ChipProps) {
  const variantClass =
    variant === "status" && status
      ? ` ui-chip-${status}`
      : variant === "dueDate"
        ? overdue
          ? " ui-chip-due ui-chip-overdue"
          : " ui-chip-due"
        : "";
  return (
    <span className={`ui-chip${variantClass}`} title={title}>
      {icon}
      {children}
    </span>
  );
}
