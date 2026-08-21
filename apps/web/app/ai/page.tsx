"use client";

import Link from "next/link";
import { ScrollText, Sparkles } from "lucide-react";
import { useUi } from "../../lib/ui-context.tsx";
import { Icon } from "../../components/ui/icon.tsx";

/** AI-plane landing: what the AI teammates do, with the two entry points that
    exist today — the mission composer (generate flow) and the action ledger. */
export default function AiTeammatesPage() {
  const { t } = useUi();
  return (
    <div className="content s2-ai">
      <div className="section-head">
        <h2 className="page-title">{t.aiTeammatesHeading}</h2>
      </div>
      <div className="s2-ai-hero">
        <span className="s2-ai-glyph" aria-hidden>
          <Icon icon={Sparkles} size={28} />
        </span>
        <h3 className="s2-ai-title">{t.aiPlaneTitle}</h3>
        <p className="s2-ai-body">{t.aiPlaneBody}</p>
        <div className="s2-ai-actions">
          <Link className="s2-ai-cta" href="/">
            {t.aiGenerateCta}
          </Link>
          <Link className="s2-ai-ghost" href="/ledger">
            <Icon icon={ScrollText} size={14} />
            {t.navLedger}
          </Link>
        </div>
      </div>
    </div>
  );
}
