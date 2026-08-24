"use client";

import { Sparkles, X } from "lucide-react";
import type { ReactElement } from "react";
import { useUi } from "../../lib/ui-context.tsx";
import { Icon } from "../ui/icon.tsx";
import { AssistantChat } from "./assistant-chat.tsx";

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Floating XCollab AI companion — docked inline-end/block-end (RTL-aware),
    z-index 33: above the quick-create dialog (32), below popovers (35) and
    toasts (40). It stays MOUNTED while closed so the transcript survives
    navigation and close/reopen; `inert` keeps focus and the tab order out
    of the hidden panel. */
export function AssistantPanel({ open, onClose }: AssistantPanelProps): ReactElement {
  const { t } = useUi();
  return (
    <section
      className="xai-float"
      data-open={open ? "" : undefined}
      inert={!open}
      aria-label={t.aiPanelTitle}
    >
      <header className="xai-float-head">
        <span className="xai-float-title">
          <Icon icon={Sparkles} size={15} />
          {t.aiPanelTitle}
        </span>
        <button type="button" className="s2-icon-btn" onClick={onClose} aria-label={t.close}>
          <Icon icon={X} size={16} />
        </button>
      </header>
      <div className="xai-float-body">
        <AssistantChat />
      </div>
    </section>
  );
}
