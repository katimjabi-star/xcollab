"use client";

import Link from "next/link";
import { ScrollText, Sparkles } from "lucide-react";
import { useUi } from "../../lib/ui-context.tsx";
import { AssistantChat } from "../../components/assistant/assistant-chat.tsx";
import { Icon } from "../../components/ui/icon.tsx";

/** AI plane: the XCollab AI chat surface. The generate flow and the AI
    Ledger stay one click away in the page header (spec §3.1). */
export default function AiTeammatesPage() {
  const { t } = useUi();
  return (
    <div className="content s2-assistant">
      <div className="section-head xai-head">
        <h2 className="page-title">{t.aiTeammatesHeading}</h2>
        <div className="xai-head-actions">
          <Link className="s2-ai-ghost" href="/">
            <Icon icon={Sparkles} size={14} />
            {t.aiGenerateCta}
          </Link>
          <Link className="s2-ai-ghost" href="/ledger">
            <Icon icon={ScrollText} size={14} />
            {t.navLedger}
          </Link>
        </div>
      </div>
      <AssistantChat />
    </div>
  );
}
