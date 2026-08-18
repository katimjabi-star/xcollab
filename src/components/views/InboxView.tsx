'use client';

import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Inbox as InboxIcon, AtSign, BadgeCheck, MessageSquare, UserPlus, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorState from '@/components/ErrorState';
import { toast } from '@/hooks/use-toast';
import { postJson } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useInbox, queryKeys } from '@/hooks/use-app-data';
import { useTranslation, formatTimeAgo } from '@/lib/i18n';
import type { InboxNotification } from '@/lib/types';

const TYPE_ICONS: Record<string, typeof AtSign> = {
  mention: AtSign,
  approval: BadgeCheck,
  comment: MessageSquare,
  assignment: UserPlus,
};

const TYPE_COLORS: Record<string, string> = {
  mention: 'var(--brand)',
  approval: '#F59E0B',
  comment: '#3B82F6',
  assignment: '#22C55E',
};

export default function InboxView() {
  const { locale, setView, setSelectedWbpId } = useAppStore();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useInbox();

  const markRead = async (ids?: string[]) => {
    try {
      await postJson('/api/inbox', ids ? { ids } : { all: true });
      await queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  };

  const open = (n: InboxNotification) => {
    if (!n.read) void markRead([n.id]);
    if (n.entityType === 'wbp' && n.entityId) {
      setSelectedWbpId(n.entityId);
      setView('wbp');
    } else if (n.entityType === 'task') {
      setView('kanban');
    }
  };

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-8 w-48 bg-xcollab-surface-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl bg-xcollab-surface-2" />
        ))}
      </div>
    );
  }

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1.5 rounded-full bg-[var(--brand)]" />
          <InboxIcon className="h-5 w-5 text-[var(--brand)]" />
          <h2 className="text-xl font-bold text-[var(--ink-1)]">{t('inbox.title')}</h2>
          {unread > 0 && (
            <span className="rounded-full bg-[var(--brand)]/15 px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--brand)] tabular-nums">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markRead()}
            className="h-8 border-xcollab-border/60 text-xs text-[var(--ink-2)] hover:text-[var(--ink-1)]"
          >
            <CheckCheck className="me-1.5 h-3.5 w-3.5" />
            {t('inbox.markAll')}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="empty-state-icon">
            <InboxIcon className="h-8 w-8 text-[var(--brand)]" />
          </div>
          <p className="text-sm font-medium text-[var(--ink-1)]">{t('inbox.empty')}</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">{t('inbox.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? MessageSquare;
            const color = TYPE_COLORS[n.type] ?? 'var(--ink-3)';
            return (
              <div
                key={n.id}
                onClick={() => open(n)}
                className={`group flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                  n.read
                    ? 'border-xcollab-border/30 bg-transparent opacity-70'
                    : 'border-xcollab-border/60 bg-xcollab-surface card-glass'
                } hover:border-xcollab-border hover:opacity-100`}
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read ? 'text-[var(--ink-2)]' : 'font-semibold text-[var(--ink-1)]'}`}>{n.title}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-3)]">{n.body}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-mono text-[10px] text-[var(--ink-3)] tabular-nums">
                    {formatTimeAgo(locale, n.createdAt)}
                  </span>
                  {!n.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void markRead([n.id]);
                      }}
                      aria-label={t('inbox.markRead')}
                      className="flex items-center gap-1 rounded-md border border-xcollab-border/50 px-1.5 py-0.5 text-[10px] text-[var(--ink-3)] opacity-0 transition-opacity hover:text-[var(--ink-1)] group-hover:opacity-100"
                    >
                      <Check className="h-3 w-3" />
                      {t('inbox.markRead')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
