"use client";

import { SettingsAppearance } from "../../components/settings-appearance.tsx";
import { SettingsProfile } from "../../components/settings-profile.tsx";
import { SettingsWorkspace } from "../../components/settings-workspace.tsx";
import { useUi } from "../../lib/ui-context.tsx";

export default function SettingsPage() {
  const { t } = useUi();
  return (
    <div className="content settings-content">
      <div className="section-head">
        <h2>{t.navSettings}</h2>
      </div>
      <SettingsProfile />
      <SettingsAppearance />
      <SettingsWorkspace />
    </div>
  );
}
