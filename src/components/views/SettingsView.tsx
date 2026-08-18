'use client';

import { motion } from 'framer-motion';
import { Settings, Shield, Globe, Palette, Bell, Database, Key, ChevronRight, Moon, Sun, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } } },
};

// EDGE Orange is the default; Katim Teal honors the program's secure-comms subsidiary.
const ACCENT_PRESETS = [
  { name: 'EDGE Orange', value: '#FF4713' },
  { name: 'Katim Teal', value: '#00B8A9' },
  { name: 'Signal Green', value: '#22C55E' },
  { name: 'Ion Blue', value: '#3B82F6' },
  { name: 'Violet', value: '#A855F7' },
];

export default function SettingsView() {
  const { locale, setLocale, theme, setTheme, accent, setAccent } = useAppStore();
  const { t } = useTranslation(locale);

  return (
    <motion.div className="space-y-6 max-w-3xl" variants={stagger.container} initial="initial" animate="animate">
      <motion.div variants={stagger.item} className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-[var(--brand)] rounded-full" />
        <Settings className="w-5 h-5 text-[var(--brand)]" />
        <h2 className="text-xl font-bold text-[var(--ink-1)]">{t('nav.settings')}</h2>
      </motion.div>

      {/* Appearance */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[var(--ink-1)] flex items-center gap-2.5">
              <Palette className="w-[14px] h-[14px] text-[var(--brand)]" />
              {t('settings.appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ink-1)] font-medium">{t('settings.theme')}</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">{t('settings.themeDesc')}</p>
              </div>
              <div className="flex items-center gap-1 bg-xcollab-surface-2 rounded-lg p-1">
                {(
                  [
                    { mode: 'dark', icon: Moon, label: t('settings.themeDark') },
                    { mode: 'light', icon: Sun, label: t('settings.themeLight') },
                    { mode: 'system', icon: Monitor, label: t('settings.themeSystem') },
                  ] as const
                ).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setTheme(mode)}
                    className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                      theme === mode
                        ? 'bg-[var(--brand)]/15 text-[var(--brand)] font-semibold'
                        : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 inline me-1.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="bg-xcollab-border/40" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ink-1)] font-medium">{t('settings.accentColor')}</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">{t('settings.accentColorDesc')}</p>
              </div>
              <div className="flex items-center gap-2">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    aria-label={preset.name}
                    title={preset.name}
                    onClick={() => setAccent(preset.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      accent === preset.value
                        ? 'border-[var(--ink-1)] scale-110'
                        : 'border-transparent hover:scale-105 hover:border-[var(--line-strong)]'
                    }`}
                    style={{ backgroundColor: preset.value, boxShadow: accent === preset.value ? `0 0 12px ${preset.value}40` : undefined }}
                  />
                ))}
              </div>
            </div>

            <Separator className="bg-xcollab-border/40" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ink-1)] font-medium">{t('common.language')}</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">{t('settings.languageDesc')}</p>
              </div>
              <Select value={locale} onValueChange={(v) => setLocale(v as 'en' | 'ar')}>
                <SelectTrigger className="w-[160px] h-9 bg-xcollab-surface-2 border-xcollab-border/60 text-sm text-[var(--ink-2)]">
                  <Globe className="w-3.5 h-3.5 me-1.5 text-[var(--ink-3)]" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-xcollab-surface border-xcollab-border">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية (Arabic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[var(--ink-1)] flex items-center gap-2.5">
              <Bell className="w-[14px] h-[14px] text-[var(--brand)]" />
              {t('settings.notifications')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {([
              { labelKey: 'settings.notifRisk', descKey: 'settings.notifRiskDesc', defaultChecked: true },
              { labelKey: 'settings.notifMilestone', descKey: 'settings.notifMilestoneDesc', defaultChecked: true },
              { labelKey: 'settings.notifTasks', descKey: 'settings.notifTasksDesc', defaultChecked: true },
              { labelKey: 'settings.notifWbp', descKey: 'settings.notifWbpDesc', defaultChecked: false },
              { labelKey: 'settings.notifAi', descKey: 'settings.notifAiDesc', defaultChecked: true },
            ] as const).map((item) => (
              <div key={item.labelKey} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--ink-1)] font-medium">{t(item.labelKey)}</p>
                  <p className="text-xs text-[var(--ink-3)] mt-0.5">{t(item.descKey)}</p>
                </div>
                <Switch defaultChecked={item.defaultChecked} />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Security */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[var(--ink-1)] flex items-center gap-2.5">
              <Shield className="w-[14px] h-[14px] text-[var(--brand)]" />
              {t('settings.security')}
            </CardTitle>
            <p className="text-[11px] text-[var(--ink-3)] mt-1.5 leading-relaxed">{t('settings.securityNote')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ink-1)] font-medium">{t('settings.zeroTrust')}</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">{t('settings.zeroTrustDesc')}</p>
              </div>
              <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[var(--ink-3)] font-semibold">{t('settings.planned')}</Badge>
            </div>
            <Separator className="bg-xcollab-border/40" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ink-1)] font-medium">{t('settings.encryption')}</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">{t('settings.encryptionDesc')}</p>
              </div>
              <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[var(--ink-3)] font-semibold">{t('settings.planned')}</Badge>
            </div>
            <Separator className="bg-xcollab-border/40" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ink-1)] font-medium">{t('settings.auditLog')}</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">{t('settings.auditLogDesc')}</p>
              </div>
              <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[var(--ink-3)] font-semibold">{t('settings.planned')}</Badge>
            </div>
            <Separator className="bg-xcollab-border/40" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ink-1)] font-medium">{t('settings.aiGuardrails')}</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">{t('settings.aiGuardrailsDesc')}</p>
              </div>
              <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[var(--ink-3)] font-semibold">{t('settings.planned')}</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Integrations */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[var(--ink-1)] flex items-center gap-2.5">
              <Database className="w-[14px] h-[14px] text-[var(--brand)]" />
              {t('settings.integrations')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {([
              { name: 'Jira Cloud', descKey: 'settings.integrationJiraDesc', connected: false, planned: true, color: '#0052CC' },
              { name: 'Claude AI (Anthropic)', descKey: 'settings.integrationClaudeDesc', connected: true, planned: false, color: '#FF4713' },
              { name: 'Slack', descKey: 'settings.integrationSlackDesc', connected: false, planned: false, color: '#E01E5A' },
              { name: 'Microsoft Teams', descKey: 'settings.integrationTeamsDesc', connected: false, planned: false, color: '#6264A7' },
            ] as const).map((item) => (
              <div key={item.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}20` }}>
                    <Key className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--ink-1)] font-medium">{item.name}</p>
                    <p className="text-xs text-[var(--ink-3)]">{t(item.descKey)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.connected ? (
                    <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-transparent text-[11px] font-semibold">{t('settings.connected')}</Badge>
                  ) : item.planned ? (
                    <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[var(--ink-3)] font-semibold">{t('settings.planned')}</Badge>
                  ) : (
                    <Button variant="outline" size="sm" className="text-[11px] h-7 border-xcollab-border/60 text-[var(--ink-3)] hover:text-[var(--ink-1)]">
                      {t('settings.connect')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* About */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--brand)] flex items-center justify-center glow-brand-logo">
                  <Shield className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--ink-1)]">XCollab <span className="text-[var(--brand)]">POC v1.0</span></p>
                  <p className="text-xs text-[var(--ink-3)]">{t('settings.aboutTagline')}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[var(--ink-3)]">
                {t('settings.build')} 2026.08.17
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
