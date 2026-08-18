'use client';

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { postJson } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useComments, useProgram, queryKeys } from '@/hooks/use-app-data';
import { useTranslation, formatTimeAgo } from '@/lib/i18n';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

/** Highlight @mentions inside a comment body. */
function Body({ text }: { text: string }) {
  const parts = text.split(/(@[\p{L}][\p{L}.'-]*(?:\s[\p{L}][\p{L}.'-]*)?)/u);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-2)]">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="font-medium text-[var(--brand)]">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

export default function DiscussionThread({ wbpId }: { wbpId: string }) {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const { data: comments } = useComments(wbpId);
  const { data: program } = useProgram();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // @mention autocomplete: triggered by a trailing "@word" in the draft
  const mentionQuery = useMemo(() => {
    const m = draft.match(/@([\p{L}]*)$/u);
    return m ? m[1].toLowerCase() : null;
  }, [draft]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null || !program) return [];
    return program.members
      .filter((m) => m.name.toLowerCase().includes(mentionQuery))
      .slice(0, 5);
  }, [mentionQuery, program]);

  const insertMention = (name: string) => {
    setDraft((d) => d.replace(/@[\p{L}]*$/u, `@${name} `));
    inputRef.current?.focus();
  };

  const post = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await postJson('/api/comments', { body, wbpId });
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.comments(wbpId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
        <MessageSquare className="h-3.5 w-3.5" />
        {t('discussion.title')}{comments && comments.length > 0 ? ` · ${comments.length}` : ''}
      </h4>

      {(!comments || comments.length === 0) && (
        <p className="mb-3 text-sm text-[var(--ink-3)]">{t('discussion.empty')}</p>
      )}

      <div className="mb-3 max-h-56 space-y-3 overflow-y-auto pe-1">
        {comments?.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar className="mt-0.5 h-7 w-7 shrink-0">
              <AvatarFallback
                className="text-[9px] font-bold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${c.author.team?.color ?? '#787886'} 15%, transparent)`,
                  color: c.author.team?.color ?? 'var(--ink-3)',
                }}
              >
                {initials(c.author.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 rounded-lg border border-xcollab-border/30 bg-xcollab-surface-2/60 px-3 py-2">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold text-[var(--ink-1)]">{c.author.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-[var(--ink-3)] tabular-nums">
                  {formatTimeAgo(locale, c.createdAt)}
                </span>
              </div>
              <Body text={c.body} />
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-full start-0 z-20 mb-1 w-60 overflow-hidden rounded-lg border border-xcollab-border bg-xcollab-surface shadow-xl">
            {mentionCandidates.map((m) => (
              <button
                key={m.id}
                onClick={() => insertMention(m.name.split(' ')[0])}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-[var(--ink-2)] transition-colors hover:bg-[var(--ink-1)]/5 hover:text-[var(--ink-1)]"
              >
                <span className="font-mono text-[10px] text-[var(--brand)]">@</span>
                {m.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post();
            }}
            placeholder={t('discussion.placeholder')}
            rows={2}
            className="min-h-[60px] flex-1 resize-none rounded-lg border border-xcollab-border/60 bg-xcollab-surface-2 px-3 py-2 text-sm text-[var(--ink-1)] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--brand)]/50"
          />
          <Button
            size="icon"
            onClick={post}
            disabled={!draft.trim() || posting}
            aria-label={t('discussion.post')}
            className="h-9 w-9 shrink-0 rounded-lg bg-[var(--brand)] text-[var(--brand-fg)] hover:bg-[var(--brand-hover)]"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
