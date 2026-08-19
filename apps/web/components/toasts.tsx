"use client";

import { useToasts } from "../lib/toast-context.tsx";
import { useUi } from "../lib/ui-context.tsx";

/** Fixed bottom-inline-end toast stack — rendered once inside the providers. */
export function Toasts() {
  const { toasts, dismiss } = useToasts();
  const { t } = useUi();

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast${toast.leaving ? " leaving" : ""}`} role="status">
          <span>{toast.message}</span>
          {toast.undo ? (
            <button
              type="button"
              className="toast-undo"
              onClick={() => {
                toast.undo?.();
                dismiss(toast.id);
              }}
            >
              {t.undo}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
