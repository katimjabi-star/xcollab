'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Paperclip, X, Sparkles, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { postJson } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { queryKeys } from '@/hooks/use-app-data';
import { useTranslation } from '@/lib/i18n';
import type { ArchitectResult } from '@/lib/types';

const EXAMPLES = [
  'I am developing a project called XCollab — a cross-team collaboration platform with advanced AI. Timeline is 3 weeks. Teams: design and QA, plus whoever else you think we need.',
  'A secure tactical drone communications program for EDGE Group under Katim, with an external antenna vendor and full certification, 14 months.',
  'Build a border-monitoring analytics dashboard called SENTINEL in 8 weeks with frontend, backend, data & AI, and security teams.',
];

const PRD_CHAR_LIMIT = 6000;

export default function CreateProgramView() {
  const { locale, setView, setSelectedWbpId } = useAppStore();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const [brief, setBrief] = useState('');
  const [prd, setPrd] = useState<{ name: string; text: string } | null>(null);
  const [designing, setDesigning] = useState(false);
  const [step, setStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const steps = [t('create.stepTeams'), t('create.stepWbps'), t('create.stepSchedule'), t('create.stepFinish')];

  // Cycle the progress narration while the architect works
  useEffect(() => {
    if (!designing) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1600);
    return () => clearInterval(id);
  }, [designing, steps.length]);

  const attach = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '').slice(0, PRD_CHAR_LIMIT);
      setPrd({ name: file.name, text });
    };
    reader.readAsText(file);
  };

  const create = async () => {
    const trimmed = brief.trim();
    if (trimmed.length < 10 || designing) return;
    setStep(0);
    setDesigning(true);
    const fullBrief = prd ? `${trimmed}\n\n--- PRD: ${prd.name} ---\n${prd.text}` : trimmed;
    try {
      const result = await postJson<ArchitectResult>('/api/architect', { brief: fullBrief.slice(0, 2000) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.program }),
        queryClient.invalidateQueries({ queryKey: queryKeys.programs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
        queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory }),
      ]);
      setSelectedWbpId(null);
      toast({
        title: t('architect.successTitle'),
        description: t('architect.successDesc').replace('{name}', result.name),
      });
      setView('dashboard');
    } catch {
      toast({ title: t('architect.error'), variant: 'destructive' });
      setDesigning(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center">
      {/* Skip to the current program */}
      <button
        onClick={() => setView('dashboard')}
        className="absolute end-8 top-20 flex items-center gap-1.5 text-xs text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
      >
        {t('create.skip')}
        <ArrowRight className="h-3 w-3 rtl:rotate-180" />
      </button>

      <AnimatePresence mode="wait">
        {designing ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)] glow-brand-logo">
              <Sparkles className="h-7 w-7 text-[var(--brand-fg)]" />
            </div>
            <h2 className="mb-8 text-xl font-bold text-[var(--ink-1)]">{t('architect.designing')}</h2>
            <div className="space-y-3 text-start">
              {steps.map((label, i) => (
                <div key={label} className={`flex items-center gap-3 text-sm transition-opacity ${i <= step ? 'opacity-100' : 'opacity-30'}`}>
                  {i < step ? (
                    <Check className="h-4 w-4 shrink-0 text-[#22C55E]" />
                  ) : i === step ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--brand)]" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border border-xcollab-border" />
                  )}
                  <span className={i === step ? 'text-[var(--ink-1)]' : 'text-[var(--ink-3)]'}>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl"
          >
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] glow-brand-logo">
                <Shield className="h-6 w-6 text-[var(--brand-fg)]" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--ink-1)]">{t('create.headline')}</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--ink-3)]">{t('create.sub')}</p>
            </div>

            <div className="rounded-2xl border border-xcollab-border/60 bg-xcollab-surface card-glass card-depth p-4">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create();
                }}
                placeholder={t('create.placeholder')}
                rows={5}
                autoFocus
                className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--ink-1)] outline-none placeholder:text-[var(--ink-3)]"
              />
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-xcollab-border/40 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".md,.txt,.markdown,text/plain,text/markdown"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) attach(f);
                      e.target.value = '';
                    }}
                  />
                  {prd ? (
                    <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 py-1 text-xs text-[var(--brand)]">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{prd.name}</span>
                      <button onClick={() => setPrd(null)} aria-label="Remove" className="shrink-0 hover:opacity-70">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-full border border-xcollab-border/60 px-3 py-1 text-xs text-[var(--ink-3)] transition-colors hover:border-xcollab-border hover:text-[var(--ink-1)]"
                    >
                      <Paperclip className="h-3 w-3" />
                      {t('create.attach')}
                    </button>
                  )}
                </div>
                <Button
                  onClick={create}
                  disabled={brief.trim().length < 10}
                  className="shrink-0 bg-[var(--brand)] text-[var(--brand-fg)] hover:bg-[var(--brand-hover)]"
                >
                  <Sparkles className="me-2 h-4 w-4" />
                  {t('create.button')}
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                {t('create.examples')}
              </p>
              <div className="flex flex-col gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.slice(0, 24)}
                    onClick={() => setBrief(ex)}
                    className="rounded-xl border border-xcollab-border/40 bg-xcollab-surface-2/50 px-4 py-2.5 text-start text-xs leading-relaxed text-[var(--ink-3)] transition-colors hover:border-xcollab-border hover:text-[var(--ink-2)]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
