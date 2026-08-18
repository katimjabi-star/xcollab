'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { fetchJson, postJson } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useApprovals, useProgram, useMe, queryKeys } from '@/hooks/use-app-data';
import { useTranslation, formatTimeAgo } from '@/lib/i18n';
import type { ApprovalWithMembers } from '@/lib/types';

const STATUS_STYLE: Record<ApprovalWithMembers['status'], { color: string }> = {
  pending: { color: '#F59E0B' },
  approved: { color: '#22C55E' },
  changes_requested: { color: '#F59E0B' },
  rejected: { color: '#EF4444' },
};

export default function ApprovalsBlock({ wbpId }: { wbpId: string }) {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const { data: approvals } = useApprovals(wbpId);
  const { data: program } = useProgram();
  const { data: me } = useMe();
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [approverId, setApproverId] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.approvals(wbpId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
  };

  const request = async () => {
    if (!title.trim() || !approverId || busy) return;
    setBusy(true);
    try {
      await postJson('/api/approvals', { wbpId, approverId, title: title.trim() });
      setTitle('');
      setApproverId('');
      setFormOpen(false);
      await refresh();
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, status: 'approved' | 'changes_requested' | 'rejected') => {
    if (busy) return;
    setBusy(true);
    try {
      await fetchJson('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      await refresh();
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
          <BadgeCheck className="h-3.5 w-3.5" />
          {t('approvals.title')}{approvals && approvals.length > 0 ? ` · ${approvals.length}` : ''}
        </h4>
        <button
          onClick={() => setFormOpen((o) => !o)}
          className="flex items-center gap-1 rounded-md border border-xcollab-border/50 px-2 py-1 text-[11px] text-[var(--ink-3)] transition-colors hover:border-xcollab-border hover:text-[var(--ink-1)]"
        >
          <Plus className="h-3 w-3" />
          {t('approvals.request')}
        </button>
      </div>

      {formOpen && (
        <div className="mb-3 space-y-2 rounded-lg border border-xcollab-border/40 bg-xcollab-surface-2/60 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('approvals.requestTitle')}
            className="w-full rounded-md border border-xcollab-border/60 bg-xcollab-surface px-3 py-2 text-sm text-[var(--ink-1)] outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--brand)]/50"
          />
          <div className="flex items-center gap-2">
            <Select value={approverId} onValueChange={setApproverId}>
              <SelectTrigger className="h-9 flex-1 border-xcollab-border/60 bg-xcollab-surface text-sm text-[var(--ink-2)]">
                <SelectValue placeholder={t('approvals.approver')} />
              </SelectTrigger>
              <SelectContent className="border-xcollab-border bg-xcollab-surface">
                {program?.members
                  .filter((m) => m.id !== me?.id)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={request}
              disabled={!title.trim() || !approverId || busy}
              className="h-9 bg-[var(--brand)] text-[var(--brand-fg)] hover:bg-[var(--brand-hover)]"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('approvals.send')}
            </Button>
          </div>
        </div>
      )}

      {approvals && approvals.length > 0 && (
        <div className="space-y-2">
          {approvals.map((a) => {
            const style = STATUS_STYLE[a.status];
            const canDecide = a.status === 'pending' && me && a.approver.id === me.id;
            return (
              <div key={a.id} className="rounded-lg border border-xcollab-border/30 bg-xcollab-surface-2/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-[var(--ink-1)]">{a.title}</span>
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: style.color, borderColor: `${style.color}40`, backgroundColor: `${style.color}12` }}
                  >
                    {t(`approvals.status.${a.status}` as Parameters<typeof t>[0])}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--ink-3)]">
                  <span className="truncate">
                    {a.requestedBy.name} → {a.approver.name}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">{formatTimeAgo(locale, a.decidedAt ?? a.createdAt)}</span>
                </div>
                {a.note && <p className="mt-1 text-xs italic text-[var(--ink-3)]">{a.note}</p>}
                {canDecide && (
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" onClick={() => decide(a.id, 'approved')} disabled={busy}
                      className="h-7 bg-[#22C55E]/15 px-2.5 text-[11px] font-semibold text-[#22C55E] hover:bg-[#22C55E]/25">
                      {t('approvals.approve')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide(a.id, 'changes_requested')} disabled={busy}
                      className="h-7 border-xcollab-border/60 px-2.5 text-[11px] text-[var(--ink-2)]">
                      {t('approvals.requestChanges')}
                    </Button>
                    <Button size="sm" onClick={() => decide(a.id, 'rejected')} disabled={busy}
                      className="h-7 bg-[#EF4444]/15 px-2.5 text-[11px] font-semibold text-[#EF4444] hover:bg-[#EF4444]/25">
                      {t('approvals.reject')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
