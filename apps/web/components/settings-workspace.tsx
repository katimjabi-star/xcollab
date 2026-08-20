"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useUi } from "../lib/ui-context.tsx";
import { Icon } from "./ui/icon.tsx";

/** Workspace facts (read-only) + link-row into /teams. */
export function SettingsWorkspace() {
  const { t } = useUi();
  return (
    <section className="settings-section" aria-labelledby="settings-workspace-title">
      <h3 id="settings-workspace-title" className="settings-section-title">
        {t.settingsWorkspaceHeading}
      </h3>
      <div className="settings-row">
        <span className="settings-label">{t.settingsWorkspaceName}</span>
        <span className="settings-value">{t.breadcrumbWorkspace}</span>
      </div>
      <Link href="/teams" className="settings-row settings-link-row">
        <span className="settings-label">{t.navTeams}</span>
        <span className="settings-value">{t.settingsManageTeams}</span>
        <span className="settings-chevron" aria-hidden>
          <Icon icon={ChevronRight} size={14} directional />
        </span>
      </Link>
    </section>
  );
}
