'use client';

import { useEffect, useState, useRef, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { ChatMessage } from '@/lib/types';

const PROGRAM_ID = 'program-brain-001'; // matches seed data

interface AIChatViewProps {
  embedded?: boolean;
}

export default function AIChatView({ embedded }: AIChatViewProps) {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch past messages
  useEffect(() => {
    setLoading(true);
    fetch(`/api/ai-chat?programId=${PROGRAM_ID}`)
      .then((r) => r.json())
      .then((data) => {
        const msgs: ChatMessage[] = (Array.isArray(data) ? data : []).map(
          (m: { id: string; role: string; content: string; createdAt: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.createdAt,
          }),
        );
        setMessages(msgs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, programId: PROGRAM_ID }),
      });
      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply || t('aiChat.error'),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: t('aiChat.error'),
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => setMessages([]);

  return (
    <div className={`flex flex-col h-full ${embedded ? '' : 'max-w-3xl mx-auto'}`}>
      {/* Header (only in full-page mode) */}
      {!embedded && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center glow-orange-sm"
              style={{ backgroundColor: '#FF471315' }}
            >
              <Bot className="w-5 h-5 text-[#FF4713]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('aiChat.title')}</h2>
              <p className="text-xs text-[#8888A0]">AI Project Manager — BRAIN Network Encryptor</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#8888A0] hover:text-white hover:bg-white/5"
            onClick={handleClear}
          >
            <Trash2 className="w-4 h-4 me-1.5" />
            {t('aiChat.clearChat')}
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8888A0]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-sm">{t('common.loading')}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                backgroundColor: '#FF471310',
                boxShadow: '0 0 30px rgba(255, 71, 19, 0.15)',
              }}
            >
              <Bot className="w-8 h-8 text-[#FF4713]" />
            </div>
            <p className="text-sm text-[#E8E8ED] max-w-md leading-relaxed">
              {t('aiChat.welcome')}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                  <AvatarFallback
                    className={`text-xs font-bold ${
                      msg.role === 'assistant'
                        ? 'bg-[#FF4713]/20 text-[#FF4713]'
                        : 'bg-xcollab-surface-3 text-[#8888A0]'
                    }`}
                    style={
                      msg.role === 'assistant'
                        ? { boxShadow: '0 0 12px rgba(255, 71, 19, 0.2)' }
                        : undefined
                    }
                  >
                    {msg.role === 'assistant' ? (
                      <Bot className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#FF4713] text-white rounded-tr-sm'
                      : 'bg-xcollab-surface-2 border border-xcollab-border/50 text-[#E8E8ED] rounded-tl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose-sm prose-invert max-w-none [&_p]:text-[#E8E8ED] [&_p]:leading-relaxed [&_strong]:text-white [&_code]:text-[#FF4713] [&_code]:bg-xcollab-surface-3 [&_code]:px-1 [&_code]:rounded [&_ul]:text-[#E8E8ED] [&_ol]:text-[#E8E8ED] [&_li]:text-[#E8E8ED] [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Typing indicator */}
        {sending && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <Avatar className="w-8 h-8 shrink-0 mt-0.5">
              <AvatarFallback
                className="text-xs font-bold bg-[#FF4713]/20 text-[#FF4713]"
                style={{ boxShadow: '0 0 12px rgba(255, 71, 19, 0.2)' }}
              >
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-xcollab-surface-2 border border-xcollab-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF4713] animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-[#FF4713] animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-[#FF4713] animate-bounce [animation-delay:300ms]" />
              </div>
              <p className="text-[10px] text-[#8888A0] mt-1.5">{t('aiChat.thinking')}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="shrink-0 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('aiChat.placeholder')}
            className="flex-1 bg-xcollab-surface-2 border-xcollab-border text-sm text-white placeholder:text-[#8888A0] h-10 focus-visible:ring-[#FF4713]/30 focus-visible:border-[#FF4713]/50"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 bg-[#FF4713] hover:bg-[#E94A26] text-white shrink-0"
            disabled={!input.trim() || sending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
