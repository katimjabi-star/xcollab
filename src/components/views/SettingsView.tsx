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

export default function SettingsView() {
  const { locale, setLocale } = useAppStore();
  const { t } = useTranslation(locale);

  return (
    <motion.div className="space-y-6 max-w-3xl" variants={stagger.container} initial="initial" animate="animate">
      <motion.div variants={stagger.item} className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-[#FF4713] rounded-full" />
        <Settings className="w-5 h-5 text-[#FF4713]" />
        <h2 className="text-xl font-bold text-[#E8E8ED]">{t('nav.settings')}</h2>
      </motion.div>

      {/* Appearance */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5">
              <Palette className="w-[14px] h-[14px] text-[#FF4713]" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#E8E8ED] font-medium">Theme</p>
                <p className="text-xs text-[#71717A] mt-0.5">Cinematic Dark is the only theme for defense-grade applications</p>
              </div>
              <div className="flex items-center gap-1 bg-xcollab-surface-2 rounded-lg p-1">
                <button className="px-3 py-1.5 rounded-md bg-[#FF4713]/15 text-[#FF4713] text-xs font-semibold">
                  <Moon className="w-3.5 h-3.5 inline me-1.5" />Dark
                </button>
                <button className="px-3 py-1.5 rounded-md text-[#71717A] text-xs hover:text-[#B0B0C0] transition-colors">
                  <Sun className="w-3.5 h-3.5 inline me-1.5" />Light
                </button>
                <button className="px-3 py-1.5 rounded-md text-[#71717A] text-xs hover:text-[#B0B0C0] transition-colors">
                  <Monitor className="w-3.5 h-3.5 inline me-1.5" />System
                </button>
              </div>
            </div>

            <Separator className="bg-xcollab-border/40" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#E8E8ED] font-medium">Accent Color</p>
                <p className="text-xs text-[#71717A] mt-0.5">Primary brand color used across the interface</p>
              </div>
              <div className="flex items-center gap-2">
                {['#FF4713', '#22C55E', '#3B82F6', '#F59E0B', '#A855F7'].map((color) => (
                  <button
                    key={color}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${color === '#FF4713' ? 'border-white scale-110' : 'border-transparent hover:border-white/30'}`}
                    style={{ backgroundColor: color, boxShadow: color === '#FF4713' ? `0 0 12px ${color}40` : undefined }}
                  />
                ))}
              </div>
            </div>

            <Separator className="bg-xcollab-border/40" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#E8E8ED] font-medium">Language</p>
                <p className="text-xs text-[#71717A] mt-0.5">Interface display language</p>
              </div>
              <Select value={locale} onValueChange={(v) => setLocale(v as 'en' | 'ar')}>
                <SelectTrigger className="w-[160px] h-9 bg-xcollab-surface-2 border-xcollab-border/60 text-sm text-[#B0B0C0]">
                  <Globe className="w-3.5 h-3.5 me-1.5 text-[#71717A]" />
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
            <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5">
              <Bell className="w-[14px] h-[14px] text-[#FF4713]" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Risk Alerts', desc: 'Get notified when risks are flagged or escalated', defaultChecked: true },
              { label: 'Milestone Reminders', desc: 'Alerts 7 days before milestone deadlines', defaultChecked: true },
              { label: 'Task Assignments', desc: 'Notify when tasks are assigned to you', defaultChecked: true },
              { label: 'WBP Status Changes', desc: 'Alerts on health or status transitions', defaultChecked: false },
              { label: 'AI Insights', desc: 'Proactive AI analysis and recommendations', defaultChecked: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#E8E8ED] font-medium">{item.label}</p>
                  <p className="text-xs text-[#71717A] mt-0.5">{item.desc}</p>
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
            <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5">
              <Shield className="w-[14px] h-[14px] text-[#FF4713]" />
              Security & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#E8E8ED] font-medium">Zero-Trust Architecture</p>
                <p className="text-xs text-[#71717A] mt-0.5">6-layer security model active</p>
              </div>
              <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-transparent text-[11px] font-semibold">Enabled</Badge>
            </div>
            <Separator className="bg-xcollab-border/40" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#E8E8ED] font-medium">Encryption at Rest</p>
                <p className="text-xs text-[#71717A] mt-0.5">AES-256-GCM for all stored data</p>
              </div>
              <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-transparent text-[11px] font-semibold">AES-256</Badge>
            </div>
            <Separator className="bg-xcollab-border/40" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#E8E8ED] font-medium">Audit Logging</p>
                <p className="text-xs text-[#71717A] mt-0.5">Complete event trail with tamper protection</p>
              </div>
              <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-transparent text-[11px] font-semibold">Active</Badge>
            </div>
            <Separator className="bg-xcollab-border/40" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#E8E8ED] font-medium">AI Security Guardrails</p>
                <p className="text-xs text-[#71717A] mt-0.5">Prompt injection prevention and output filtering</p>
              </div>
              <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-transparent text-[11px] font-semibold">Active</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Integrations */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5">
              <Database className="w-[14px] h-[14px] text-[#FF4713]" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Jira Cloud', desc: 'Bidirectional WBP ↔ Epic/Story sync', connected: true, color: '#0052CC' },
              { name: 'Claude AI (Anthropic)', desc: 'Multi-agent AI pipeline with Opus/Sonnet/Haiku', connected: true, color: '#FF4713' },
              { name: 'Slack', desc: 'Notifications and standup summaries', connected: false, color: '#E01E5A' },
              { name: 'Microsoft Teams', desc: 'Cross-team collaboration channels', connected: false, color: '#6264A7' },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}20` }}>
                    <Key className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-sm text-[#E8E8ED] font-medium">{item.name}</p>
                    <p className="text-xs text-[#71717A]">{item.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.connected ? (
                    <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-transparent text-[11px] font-semibold">Connected</Badge>
                  ) : (
                    <Button variant="outline" size="sm" className="text-[11px] h-7 border-xcollab-border/60 text-[#71717A] hover:text-[#E8E8ED]">
                      Connect
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
                <div className="w-9 h-9 rounded-lg bg-[#FF4713] flex items-center justify-center shadow-[0_0_12px_rgba(255,71,19,0.3)]">
                  <Shield className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#E8E8ED]">XCollab <span className="text-[#FF4713]">POC v1.0</span></p>
                  <p className="text-xs text-[#71717A]">AI-Native Cross-Team Workflow Platform — EDGE Group</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[#71717A]">
                Build 2026.08.17
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
