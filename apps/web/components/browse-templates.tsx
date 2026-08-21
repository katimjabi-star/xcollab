"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarClock, History, Network, X, type LucideIcon } from "lucide-react";
import type { STRINGS } from "../lib/i18n.ts";
import { Icon } from "./ui/icon.tsx";

type Strings = (typeof STRINGS)["en"];

const DISMISS_KEY = "xcollab.browse.templatesDismissed";

interface TemplateCard {
  id: string;
  icon: LucideIcon;
  /** Pastel tile tint — swatch tokens hold on light and dark grounds. */
  tint: string;
  title: (t: Strings) => string;
  description: (t: Strings) => string;
}

/* XCollab AI generation presets. Each card routes into the existing
   program-generate flow on "/" (the mission composer). The flow takes no
   prefill query param today (verified in app/page.tsx), so cards navigate
   plain — the preset title tells the user what mission to state. */
const TEMPLATES: readonly TemplateCard[] = [
  {
    id: "delivery",
    icon: Network,
    tint: "var(--swatch-purple)",
    title: (t) => t.templateDeliveryTitle,
    description: (t) => t.templateDeliveryDesc,
  },
  {
    id: "agenda",
    icon: CalendarClock,
    tint: "var(--swatch-pink)",
    title: (t) => t.templateAgendaTitle,
    description: (t) => t.templateAgendaDesc,
  },
  {
    id: "retro",
    icon: History,
    tint: "var(--swatch-blue)",
    title: (t) => t.templateRetroTitle,
    description: (t) => t.templateRetroDesc,
  },
];

/** Dismissible "Explore ready-made templates" section under the projects
    table: three preset cards + a centered ghost gallery button (stub — it
    scrolls the cards into view). Dismissal persists in localStorage; the
    hidden→shown decision happens post-mount to keep hydration clean. */
export function BrowseTemplates({ t }: { t: Strings }) {
  const [visible, setVisible] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(window.localStorage.getItem(DISMISS_KEY) !== "1");
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <section className="browse-templates" aria-label={t.templatesHeading}>
      <div className="browse-templates-head">
        <h2>{t.templatesHeading}</h2>
        <button
          type="button"
          className="browse-templates-dismiss"
          aria-label={t.templatesDismiss}
          title={t.templatesDismiss}
          onClick={dismiss}
        >
          <Icon icon={X} size={14} />
        </button>
      </div>
      <div className="browse-template-grid" ref={gridRef}>
        {TEMPLATES.map((template) => (
          <Link key={template.id} className="browse-template-card" href="/">
            <span
              className="browse-template-icon"
              style={{
                color: template.tint,
                background: `color-mix(in oklab, ${template.tint} 18%, transparent)`,
              }}
              aria-hidden
            >
              <Icon icon={template.icon} size={18} />
            </span>
            <span className="browse-template-title">{template.title(t)}</span>
            <span className="browse-template-desc">{template.description(t)}</span>
          </Link>
        ))}
      </div>
      <div className="browse-templates-foot">
        <button
          type="button"
          className="browse-ghost-btn"
          onClick={() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
        >
          {t.templatesGallery}
        </button>
      </div>
    </section>
  );
}
