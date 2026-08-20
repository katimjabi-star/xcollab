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
  /** Chip is a click target: keeps the 20px visual but expands the hit area
      to ≥28px (.ui-chip-interactive inset pseudo-element). The chip stays a
      span — the caller supplies the interactive wrapper/handler. */
  interactive?: boolean;
  children: ReactNode;
  title?: string;
}

/** 20px-tall tinted chip: 10-15% tint background + full-strength text. */
export function Chip({
  variant,
  status,
  overdue = false,
  icon,
  interactive = false,
  children,
  title,
}: ChipProps) {
  const variantClass =
    variant === "status" && status
      ? ` ui-chip-${status}`
      : variant === "dueDate"
        ? overdue
          ? " ui-chip-due ui-chip-overdue"
          : " ui-chip-due"
        : "";
  const interactiveClass = interactive ? " ui-chip-interactive" : "";
  return (
    <span className={`ui-chip${variantClass}${interactiveClass}`} title={title}>
      {icon}
      {children}
    </span>
  );
}
