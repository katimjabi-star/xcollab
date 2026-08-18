'use client';

import { useEffect, useState, useRef, useCallback, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Trash2, Loader2, Shield, Zap, AlertTriangle, BarChart3, Lightbulb, Sparkles, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import { toast } from '@/hooks/use-toast';
import { fetchJson, postJson } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useChatHistory, queryKeys } from '@/hooks/use-app-data';
import { useTranslation } from '@/lib/i18n';
import type { ChatHistoryResponse, ChatResponse, ArchitectResult } from '@/lib/types';

// Labels are translation keys; prompts are the raw payloads sent to the AI API.
const QUICK_ACTIONS = [
  { labelKey: 'aiChat.actionBlockers', prompt: 'What is blocking our release? Identify all critical blockers.', icon: AlertTriangle, color: '#EF4444' },
  { labelKey: 'aiChat.actionStandup', prompt: 'Generate a daily standup summary for all teams in the BRAIN program.', icon: BarChart3, color: '#3B82F6' },
  { labelKey: 'aiChat.actionRisk', prompt: 'Run a comprehensive risk assessment across all WBPs and provide mitigation recommendations.', icon: Shield, color: '#F59E0B' },
  { labelKey: 'aiChat.actionSprint', prompt: 'Create a sprint plan for the next 2 weeks based on current priorities and team capacity.', icon: Zap, color: '#22C55E' },
  { labelKey: 'aiChat.actionResource', prompt: 'Analyze team workloads and suggest resource reallocation to unblock critical path items.', icon: Lightbulb, color: '#A855F7' },
  { labelKey: 'aiChat.actionWbpSummary', prompt: 'Give me a complete summary of all work packages with their current status and health.', icon: Sparkles, color: '#FF4713' },
] as const;

interface AIChatViewProps {
  embedded?: boolean;
}

export default function AIChatView({ embedded }: AIChatViewProps) {
  const { locale, programName, pendingAiPrompt, setPendingAiPrompt, setView, setSelectedWbpId } = useAppStore();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const { data: history, isLoading: loading } = useChatHistory();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const consumedPromptRef = useRef<string | null>(null);
  const [architectOpen, setArchitectOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [designing, setDesigning] = useState(false);

  const messages = history?.messages ?? [];

  const runArchitect = async () => {
    const trimmedBrief = brief.trim();
    if (trimmedBrief.length < 10 || designing) return;
    setDesigning(true);
    try {
      const result = await postJson<ArchitectResult>('/api/architect', { brief: trimmedBrief });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.program }),
        queryClient.invalidateQueries({ queryKey: queryKeys.programs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
        queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory }),
      ]);
      setSelectedWbpId(null);
      setArchitectOpen(false);
      setBrief('');
      toast({
        title: t('architect.successTitle'),
        description: t('architect.successDesc').replace('{name}', result.name),
      });
      setView('wbp');
    } catch {
      toast({ title: t('architect.error'), variant: 'destructive' });
    } finally {
      setDesigning(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, sending]);

  const appendToHistory = useCallback(
    async (role: 'user' | 'assistant', content: string) => {
      // A background history refetch resolving after this write would replace
      // the cache and make the appended message vanish — cancel it first.
      await queryClient.cancelQueries({ queryKey: queryKeys.chatHistory });
      queryClient.setQueryData<ChatHistoryResponse>(queryKeys.chatHistory, (old) => ({
        programId: old?.programId ?? '',
        messages: [
          ...(old?.messages ?? []),
          { id: `local-${crypto.randomUUID()}`, role, content, createdAt: new Date().toISOString() },
        ],
      }));
    },
    [queryClient],
  );

  const handleSend = useCallback(
    async (e?: FormEvent, customPrompt?: string) => {
      e?.preventDefault();
      const trimmed = (customPrompt ?? input).trim();
      if (!trimmed || sending) return;

      await appendToHistory('user', trimmed);
      setInput('');
      setSending(true);
      setActiveAgent(trimmed.toLowerCase().includes('risk') ? 'aiChat.agentRisk' : trimmed.toLowerCase().includes('block') ? 'aiChat.agentOrchestrator' : 'aiChat.agentAnalyst');

      try {
        const data = await postJson<ChatResponse>('/api/ai-chat', { message: trimmed });
        await appendToHistory('assistant', data.reply || t('aiChat.error'));
      } catch {
        await appendToHistory('assistant', t('aiChat.error'));
      } finally {
        setSending(false);
        setActiveAgent('');
        inputRef.current?.focus();
      }
    },
    [input, sending, appendToHistory, t, queryClient],
  );

  // Prompt handed off from the command palette — send it once history is ready.
  // The ref guard makes this idempotent under StrictMode's double-invoked
  // effects; the microtask keeps the effect body itself render-safe.
  useEffect(() => {
    if (!pendingAiPrompt) {
      consumedPromptRef.current = null;
      return;
    }
    if (loading || sending || embedded) return;
    if (consumedPromptRef.current === pendingAiPrompt) return;
    consumedPromptRef.current = pendingAiPrompt;
    const prompt = pendingAiPrompt;
    queueMicrotask(() => {
      setPendingAiPrompt(null);
      void handleSend(undefined, prompt);
    });
  }, [pendingAiPrompt, loading, sending, embedded, setPendingAiPrompt, handleSend]);

  const handleClear = async () => {
    try {
      await queryClient.cancelQueries({ queryKey: queryKeys.chatHistory });
      await fetchJson('/api/ai-chat', { method: 'DELETE' });
      queryClient.setQueryData<ChatHistoryResponse>(queryKeys.chatHistory, (old) => ({
        programId: old?.programId ?? '',
        messages: [],
      }));
    } catch {
      toast({ title: t('aiChat.clearFailed'), description: t('aiChat.clearFailedDesc'), variant: 'destructive' });
    }
  };

  return (
    <div className={`flex flex-col h-full ${embedded ? '' : 'max-w-3xl mx-auto'}`}>
      {/* Header (full-page) */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--brand)]/12 border border-[var(--brand)]/20">
              <Bot className="w-5 h-5 text-[var(--brand)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--ink-1)]">{t('aiChat.title')}</h2>
              <p className="text-xs text-[var(--ink-3)] mt-0.5">{programName} · EDGE Group / Katim</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setArchitectOpen(true)}
              className="bg-[var(--brand)] text-[var(--brand-fg)] hover:bg-[var(--brand-hover)]"
            >
              <Wand2 className="w-4 h-4 me-1.5" />
              {t('architect.title')}
            </Button>
            <Button variant="ghost" size="sm" className="text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--ink-1)]/5" onClick={handleClear}>
              <Trash2 className="w-4 h-4 me-1.5" />{t('aiChat.clearChat')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={architectOpen} onOpenChange={(open) => { if (!designing) setArchitectOpen(open); }}>
        <DialogContent className="border-xcollab-border bg-xcollab-surface sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--ink-1)]">
              <Wand2 className="h-4 w-4 text-[var(--brand)]" />
              {t('architect.title')}
            </DialogTitle>
            <DialogDescription className="text-[var(--ink-3)]">{t('architect.desc')}</DialogDescription>
          </DialogHeader>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={t('architect.placeholder')}
            rows={4}
            disabled={designing}
            className="w-full resize-none rounded-lg border border-xcollab-border/60 bg-xcollab-surface-2 px-3 py-2.5 text-sm text-[var(--ink-1)] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--brand)]/50"
          />
          <Button
            onClick={runArchitect}
            disabled={brief.trim().length < 10 || designing}
            className="w-full bg-[var(--brand)] text-[var(--brand-fg)] hover:bg-[var(--brand-hover)]"
          >
            {designing ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('architect.designing')}
              </>
            ) : (
              <>
                <Sparkles className="me-2 h-4 w-4" />
                {t('architect.create')}
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 px-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--ink-3)]"><Loader2 className="w-6 h-6 animate-spin mb-3" /><span className="text-sm">{t('common.loading')}</span></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="empty-state-icon"><Shield className="w-8 h-8 text-[var(--brand)]" /></div>
            <p className="text-sm text-[var(--ink-1)] max-w-md leading-relaxed mt-3">{t('aiChat.welcome')}</p>
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 w-full max-w-lg">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.labelKey}
                    onClick={() => handleSend(undefined, action.prompt)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-xcollab-surface-2 border border-xcollab-border/40 text-start card-hover group"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${action.color}15` }}><Icon className="w-4 h-4" style={{ color: action.color }} /></div>
                    <span className="text-xs text-[var(--ink-2)] group-hover:text-[var(--ink-1)] font-medium leading-tight">{t(action.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                  <AvatarFallback className={`text-xs font-bold ${msg.role === 'assistant' ? 'bg-[var(--brand)]/15 text-[var(--brand)] glow-brand-avatar' : 'bg-xcollab-surface-3 text-[var(--ink-3)]'}`} >
                    {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[var(--brand)] text-white rounded-tr-sm' : 'bg-xcollab-surface-2 border border-xcollab-border/40 text-[var(--ink-2)] rounded-tl-sm'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose-sm prose-invert max-w-none [&_p]:text-[var(--ink-2)] [&_p]:leading-relaxed [&_strong]:text-[var(--ink-1)] [&_code]:text-[var(--brand)] [&_code]:bg-xcollab-surface-3 [&_code]:px-1 [&_code]:rounded [&_ul]:text-[var(--ink-2)] [&_ol]:text-[var(--ink-2)] [&_li]:text-[var(--ink-2)] [&_h1]:text-[var(--ink-1)] [&_h2]:text-[var(--ink-1)] [&_h3]:text-[var(--ink-1)]">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Typing indicator */}
        {sending && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <Avatar className="w-8 h-8 shrink-0 mt-0.5"><AvatarFallback className="text-xs font-bold bg-[var(--brand)]/15 text-[var(--brand)] glow-brand-avatar"><Bot className="w-4 h-4" /></AvatarFallback></Avatar>
            <div className="bg-xcollab-surface-2 border border-xcollab-border/40 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-bounce [animation-delay:0ms]" /><span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-bounce [animation-delay:150ms]" /><span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-bounce [animation-delay:300ms]" /></div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-[11px] text-[var(--ink-3)]">{t('aiChat.thinking')}</p>
                {activeAgent && <Badge className="text-[10px] bg-[var(--brand)]/15 text-[var(--brand)] border-transparent px-1.5 py-0">{t(activeAgent as Parameters<typeof t>[0])}</Badge>}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick actions bar (when messages exist) */}
      {messages.length > 0 && !embedded && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {QUICK_ACTIONS.slice(0, 4).map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.labelKey} onClick={() => handleSend(undefined, action.prompt)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-xcollab-surface-2 border border-xcollab-border/40 text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:border-xcollab-border/80 text-xs whitespace-nowrap transition-colors">
                <Icon className="w-3 h-3" style={{ color: action.color }} />{t(action.labelKey)}
              </button>
            );
          })}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="shrink-0 pt-4 pb-1">
        <div className="flex items-center gap-3">
          <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('aiChat.placeholder')} className="flex-1 bg-xcollab-surface-2 border-xcollab-border/60 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] h-11 rounded-lg focus-visible:ring-[var(--brand)]/30 focus-visible:border-[var(--brand)]/50" disabled={sending} />
          <Button type="submit" size="icon" className="h-11 w-11 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white shrink-0 rounded-lg" disabled={!input.trim() || sending} aria-label={t('aiChat.send')}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
