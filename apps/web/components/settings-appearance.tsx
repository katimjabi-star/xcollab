"use client";

import { useUi } from "../lib/ui-context.tsx";
import type { ThemeMode } from "../lib/theme.ts";
import type { UiLanguage } from "../lib/i18n.ts";

interface RadioPillsProps<V extends string> {
  name: string;
  label: string;
  value: V;
  options: ReadonlyArray<{ value: V; label: string }>;
  onChange: (value: V) => void;
}

/** 36px settings row with native-radio pills (keyboard arrows come free). */
function RadioPills<V extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: RadioPillsProps<V>) {
  const labelId = `${name}-label`;
  return (
    <div className="settings-row">
      <span className="settings-label" id={labelId}>
        {label}
      </span>
      <div className="settings-pills" role="radiogroup" aria-labelledby={labelId}>
        {options.map((option) => (
          <label className="settings-pill" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Theme (three-state, pinned unless "system") + language (EN/AR). */
export function SettingsAppearance() {
  const { t, themeMode, setTheme, language, toggleLanguage } = useUi();

  const themeOptions: ReadonlyArray<{ value: ThemeMode; label: string }> = [
    { value: "light", label: t.themeLight },
    { value: "dark", label: t.themeDark },
    { value: "system", label: t.themeOptionSystem },
  ];
  const languageOptions: ReadonlyArray<{ value: UiLanguage; label: string }> = [
    { value: "en", label: t.langOptionEnglish },
    { value: "ar", label: t.langOptionArabic },
  ];

  return (
    <section className="settings-section" aria-labelledby="settings-appearance-title">
      <h3 id="settings-appearance-title" className="settings-section-title">
        {t.settingsAppearanceHeading}
      </h3>
      <RadioPills
        name="settings-theme"
        label={t.settingsThemeLabel}
        value={themeMode}
        options={themeOptions}
        onChange={setTheme}
      />
      <RadioPills
        name="settings-language"
        label={t.settingsLanguageLabel}
        value={language}
        options={languageOptions}
        onChange={(next) => {
          if (next !== language) toggleLanguage();
        }}
      />
    </section>
  );
}
