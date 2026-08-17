'use client';

import { useEffect, useState, useRef, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Trash2, Loader2, Shield, Zap, AlertTriangle, BarChart3, Lightbulb, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { ChatMessage } from '@/lib/types';

const PROGRAM_ID = 'program-brain-001';

const QUICK_ACTIONS = [
  { label: 'Identify Blockers', prompt: 'What is blocking our release? Identify all critical blockers.', icon: AlertTriangle, color: '#EF4444' },
  { label: 'Standup Report', prompt: 'Generate a daily standup summary for all teams in the BRAIN program.', icon: BarChart3, color: '#3B82F6' },
  { label: 'Risk Analysis', prompt: 'Run a comprehensive risk assessment across all WBPs and provide mitigation recommendations.', icon: Shield, color: '#F59E0B' },
  { label: 'Sprint Plan', prompt: 'Create a sprint plan for the next 2 weeks based on current priorities and team capacity.', icon: Zap, color: '#22C55E' },
  { label: 'Resource Allocation', prompt: 'Analyze team workloads and suggest resource reallocation to unblock critical path items.', icon: Lightbulb, color: '#A855F7' },
  { label: 'WBP Summary', prompt: 'Give me a complete summary of all work packages with their current status and health.', icon: Sparkles, color: '#FF4713' },
];

interface AIChatViewProps {
  embedded?: boolean;
}

export default function AIChatView({ embedded }: AIChatViewProps) {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ai-chat?programId=${PROGRAM_ID}`)
      .then((r) => r.json())
      .then((data) => {
        const msgs: ChatMessage[] = (Array.isArray(data) ? data : []).map(
          (m: { id: string; role: string; content: string; createdAt: string }) => ({
            id: m.id, role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.createdAt,
          }),
        );
        setMessages(msgs); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, sending]);

  const handleSend = async (e?: FormEvent, customPrompt?: string) => {
    e?.preventDefault();
    const trimmed = customPrompt || input.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput(''); setSending(true);
    setActiveAgent(trimmed.toLowerCase().includes('risk') ? 'Risk Analyst (Opus)' : trimmed.toLowerCase().includes('block') ? 'Orchestrator (Opus)' : 'Analyst (Sonnet)');

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, programId: PROGRAM_ID }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: data.reply || t('aiChat.error'), timestamp: new Date().toISOString() }]);
    } catch {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: t('aiChat.error'), timestamp: new Date().toISOString() }]);
    } finally { setSending(false); setActiveAgent(''); inputRef.current?.focus(); }
  };

  return (
    <div className={`flex flex-col h-full ${embedded ? '' : 'max-w-3xl mx-auto'}`}>
      {/* Header (full-page) */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FF4713]/12 border border-[#FF4713]/20">
              <Bot className="w-5 h-5 text-[#FF4713]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#E8E8ED]">{t('aiChat.title')}</h2>
              <p className="text-xs text-[#71717A] mt-0.5">Multi-Agent AI — BRAIN Network Encryptor</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5" onClick={() => setMessages([])}>
            <Trash2 className="w-4 h-4 me-1.5" />{t('aiChat.clearChat')}
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 px-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-[#71717A]"><Loader2 className="w-6 h-6 animate-spin mb-3" /><span className="text-sm">{t('common.loading')}</span></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="empty-state-icon"><Shield className="w-8 h-8 text-[#FF4713]" /></div>
            <p className="text-sm text-[#E8E8ED] max-w-md leading-relaxed mt-3">{t('aiChat.welcome')}</p>
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 w-full max-w-lg">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleSend(undefined, action.prompt)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-xcollab-surface-2 border border-xcollab-border/40 text-start card-hover group"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${action.color}15` }}><Icon className="w-4 h-4" style={{ color: action.color }} /></div>
                    <span className="text-xs text-[#B0B0C0] group-hover:text-[#E8E8ED] font-medium leading-tight">{action.label}</span>
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
                  <AvatarFallback className={`text-xs font-bold ${msg.role === 'assistant' ? 'bg-[#FF4713]/15 text-[#FF4713]' : 'bg-xcollab-surface-3 text-[#71717A]'}`} style={msg.role === 'assistant' ? { boxShadow: '0 0 12px rgba(255, 71, 19, 0.15)' } : undefined}>
                    {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#FF4713] text-white rounded-tr-sm' : 'bg-xcollab-surface-2 border border-xcollab-border/40 text-[#B0B0C0] rounded-tl-sm'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose-sm prose-invert max-w-none [&_p]:text-[#B0B0C0] [&_p]:leading-relaxed [&_strong]:text-[#E8E8ED] [&_code]:text-[#FF4713] [&_code]:bg-xcollab-surface-3 [&_code]:px-1 [&_code]:rounded [&_ul]:text-[#B0B0C0] [&_ol]:text-[#B0B0C0] [&_li]:text-[#B0B0C0] [&_h1]:text-[#E8E8ED] [&_h2]:text-[#E8E8ED] [&_h3]:text-[#E8E8ED]">
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
            <Avatar className="w-8 h-8 shrink-0 mt-0.5"><AvatarFallback className="text-xs font-bold bg-[#FF4713]/15 text-[#FF4713]" style={{ boxShadow: '0 0 12px rgba(255, 71, 19, 0.15)' }}><Bot className="w-4 h-4" /></AvatarFallback></Avatar>
            <div className="bg-xcollab-surface-2 border border-xcollab-border/40 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FF4713] animate-bounce [animation-delay:0ms]" /><span className="w-2 h-2 rounded-full bg-[#FF4713] animate-bounce [animation-delay:150ms]" /><span className="w-2 h-2 rounded-full bg-[#FF4713] animate-bounce [animation-delay:300ms]" /></div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-[11px] text-[#71717A]">{t('aiChat.thinking')}</p>
                {activeAgent && <Badge className="text-[10px] bg-[#FF4713]/15 text-[#FF4713] border-transparent px-1.5 py-0">{activeAgent}</Badge>}
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
              <button key={action.label} onClick={() => handleSend(undefined, action.prompt)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-xcollab-surface-2 border border-xcollab-border/40 text-[#71717A] hover:text-[#E8E8ED] hover:border-xcollab-border/80 text-xs whitespace-nowrap transition-colors">
                <Icon className="w-3 h-3" style={{ color: action.color }} />{action.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="shrink-0 pt-4 pb-1">
        <div className="flex items-center gap-3">
          <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('aiChat.placeholder')} className="flex-1 bg-xcollab-surface-2 border-xcollab-border/60 text-sm text-[#E8E8ED] placeholder:text-[#71717A] h-11 rounded-lg focus-visible:ring-[#FF4713]/30 focus-visible:border-[#FF4713]/50" disabled={sending} />
          <Button type="submit" size="icon" className="h-11 w-11 bg-[#FF4713] hover:bg-[#E94A26] text-white shrink-0 rounded-lg" disabled={!input.trim() && !sending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
