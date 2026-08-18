'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  X,
  Calendar,
  AlertTriangle,
  FolderTree,
  MilestoneIcon,
  ListChecks,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ErrorState from '@/components/ErrorState';
import DiscussionThread from '@/components/DiscussionThread';
import ApprovalsBlock from '@/components/ApprovalsBlock';
import { useAppStore } from '@/lib/store';
import { useProgram } from '@/hooks/use-app-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation, isRTL } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import type { WBPFlat } from '@/lib/types';

const HEALTH_COLORS: Record<string, string> = {
  'on-track': '#22C55E',
  'at-risk': '#F59E0B',
  'off-track': '#EF4444',
  behind: '#EF4444',
  completed: '#3B82F6',
};

const SEVERITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'outline',
  high: 'default',
  critical: 'destructive',
};

function formatDate(locale: Locale, d: string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(d));
}

function taskStats(wbp: WBPFlat): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const walk = (w: WBPFlat) => {
    total += w.tasks.length;
    done += w.tasks.filter((t) => t.status === 'done').length;
    w.children?.forEach(walk);
  };
  walk(wbp);
  return { done, total };
}

/* ---- Radial progress dial — the package's primary instrument ---- */

function ProgressDial({ value, color, size = 44 }: { value: number; color: string; size?: number }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-[var(--ink-1)] tabular-nums">
        {value}
      </span>
    </div>
  );
}

/* ---- Segmented task spine: done / in-progress / remaining ---- */

function TaskSpine({ wbp }: { wbp: WBPFlat }) {
  const all: WBPFlat['tasks'] = [];
  const walk = (w: WBPFlat) => {
    all.push(...w.tasks);
    w.children?.forEach(walk);
  };
  walk(wbp);
  if (all.length === 0) return null;
  const done = all.filter((t) => t.status === 'done').length;
  const active = all.filter((t) => t.status === 'in-progress' || t.status === 'review').length;
  const rest = all.length - done - active;
  return (
    <div className="flex h-1 w-full gap-px overflow-hidden rounded-full">
      {done > 0 && <div className="bg-[#22C55E]/70" style={{ flex: done }} />}
      {active > 0 && <div className="bg-[var(--brand)]/70" style={{ flex: active }} />}
      {rest > 0 && <div className="bg-[var(--line)]" style={{ flex: rest }} />}
    </div>
  );
}

/* ---- Child rows: schematic rails ---- */

interface ChildNodeProps {
  wbp: WBPFlat;
  depth: number;
  locale: Locale;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

function ChildNode({ wbp, depth, locale, selectedId, expandedIds, onSelect, onToggle }: ChildNodeProps) {
  const { t } = useTranslation(locale);
  const hasChildren = !!wbp.children && wbp.children.length > 0;
  const isExpanded = expandedIds.has(wbp.id);
  const isSelected = selectedId === wbp.id;
  const health = HEALTH_COLORS[wbp.health] || '#71717A';
  const { done, total } = taskStats(wbp);

  return (
    <div className="relative">
      {/* connector tick from the rail */}
      <span className="pointer-events-none absolute start-0 top-1/2 hidden h-px w-4 bg-xcollab-border/50 sm:block" aria-hidden />
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onClick={() => onSelect(wbp.id)}
        className={`group ms-0 sm:ms-4 mb-1.5 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150 ${
          isSelected
            ? 'border-[var(--brand)]/40 bg-[var(--brand)]/[0.06]'
            : 'border-xcollab-border/30 bg-xcollab-surface-2/40 hover:border-xcollab-border/70 hover:bg-xcollab-surface-2'
        }`}
      >
        {hasChildren ? (
          <button
            aria-label={isExpanded ? t('wbp.collapse') : t('wbp.expand')}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(wbp.id);
            }}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? '' : 'ltr:-rotate-90 rtl:rotate-90'}`} />
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0 text-center text-[10px] leading-5 text-[var(--line-strong)]">•</span>
        )}

        <span
          className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-[var(--ink-2)]"
          style={{ borderColor: `${health}40`, backgroundColor: `${health}10` }}
        >
          {wbp.code}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-2)] transition-colors group-hover:text-[var(--ink-1)]">
          {wbp.name}
        </span>

        {total > 0 && (
          <span className="hidden shrink-0 font-mono text-[10px] text-[var(--ink-3)] tabular-nums md:inline">
            {done}/{total}
          </span>
        )}

        <Badge variant="outline" className="hidden shrink-0 border-xcollab-border/50 text-[10px] text-[var(--ink-3)] xl:inline-flex">
          {t(`wbp.status.${wbp.status}` as Parameters<typeof t>[0])}
        </Badge>

        <div className="hidden w-20 shrink-0 items-center gap-2 sm:flex">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-xcollab-surface-3">
            <div className="h-full rounded-full" style={{ width: `${wbp.progress}%`, backgroundColor: health }} />
          </div>
          <span className="w-7 text-end font-mono text-[10px] text-[var(--ink-3)] tabular-nums">{wbp.progress}</span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="relative ms-4 overflow-hidden border-s border-xcollab-border/40 ps-2 sm:ms-8"
          >
            {wbp.children.map((child) => (
              <ChildNode
                key={child.id}
                wbp={child}
                depth={depth + 1}
                locale={locale}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---- Top-level package bay ---- */

interface PackageBayProps {
  wbp: WBPFlat;
  locale: Locale;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

function PackageBay({ wbp, locale, selectedId, expandedIds, onSelect, onToggle }: PackageBayProps) {
  const { t } = useTranslation(locale);
  const hasChildren = !!wbp.children && wbp.children.length > 0;
  const isExpanded = expandedIds.has(wbp.id);
  const isSelected = selectedId === wbp.id;
  const health = HEALTH_COLORS[wbp.health] || '#71717A';
  const teamColor = wbp.ownerTeam?.color || '#71717A';
  const { done, total } = taskStats(wbp);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`relative mb-3 overflow-hidden rounded-xl border card-glass transition-colors ${
        isSelected ? 'border-[var(--brand)]/50' : 'border-xcollab-border/50 hover:border-xcollab-border'
      }`}
    >
      {/* team color edge */}
      <span className="absolute inset-y-0 start-0 w-[3px]" style={{ backgroundColor: teamColor }} aria-hidden />

      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onClick={() => onSelect(wbp.id)}
        className="flex cursor-pointer items-center gap-4 bg-xcollab-surface/60 px-4 py-3.5 ps-5"
      >
        {hasChildren && (
          <button
            aria-label={isExpanded ? t('wbp.collapse') : t('wbp.expand')}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-xcollab-border/50 text-[var(--ink-3)] transition-colors hover:border-xcollab-border hover:text-[var(--ink-1)]"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(wbp.id);
            }}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? '' : 'ltr:-rotate-90 rtl:rotate-90'}`} />
          </button>
        )}

        <ProgressDial value={wbp.progress} color={health} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="shrink-0 font-mono text-[11px] font-semibold tracking-widest text-[var(--brand)]">{wbp.code}</span>
            <h3 className="truncate text-[15px] font-semibold text-[var(--ink-1)]">{wbp.name}</h3>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--ink-3)]">
            {wbp.ownerTeam && (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: teamColor }} />
                <span className="truncate">{wbp.ownerTeam.name}</span>
              </span>
            )}
            <span className="hidden shrink-0 items-center gap-1 sm:flex">
              <Calendar className="h-3 w-3" />
              <span className="font-mono tabular-nums">{formatDate(locale, wbp.dueDate)}</span>
            </span>
            {total > 0 && (
              <span className="hidden shrink-0 items-center gap-1 md:flex">
                <ListChecks className="h-3 w-3" />
                <span className="font-mono tabular-nums">
                  {done}/{total}
                </span>
              </span>
            )}
          </div>
        </div>

        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ borderColor: `${health}40`, color: health, backgroundColor: `${health}12` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: health, boxShadow: `0 0 6px ${health}` }} />
          <span className="hidden sm:inline">{t(`wbp.health.${wbp.health}` as Parameters<typeof t>[0])}</span>
        </span>
      </div>

      <div className="px-4 ps-5">
        <TaskSpine wbp={wbp} />
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="relative border-s border-xcollab-border/40 py-3 pe-3 ps-3 sm:ms-7 sm:ps-0">
              {wbp.children.map((child) => (
                <ChildNode
                  key={child.id}
                  wbp={child}
                  depth={1}
                  locale={locale}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onSelect={onSelect}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/* ---- Detail dossier ---- */

interface DetailPanelProps {
  wbp: WBPFlat;
  onClose: () => void;
}

function DetailPanel({ wbp, onClose }: DetailPanelProps) {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const isMobile = useIsMobile();
  const health = HEALTH_COLORS[wbp.health] || '#71717A';
  const teamColor = wbp.ownerTeam?.color || '#71717A';

  const content = (
    <div className="space-y-6">
      {/* Identity block */}
      <div className="rounded-xl border border-xcollab-border/50 bg-xcollab-surface-2/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="font-mono text-[11px] font-semibold tracking-widest text-[var(--brand)]">{wbp.code}</span>
            <h3 className="mt-1 text-lg font-bold leading-tight text-[var(--ink-1)]">{wbp.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="border-xcollab-border/60 text-[10px] text-[var(--ink-2)]">
                {t(`wbp.status.${wbp.status}` as Parameters<typeof t>[0])}
              </Badge>
              <Badge variant="outline" className="border-[#F59E0B]/40 text-[10px] text-[#F59E0B]">
                {t(`wbp.priority.${wbp.priority}` as Parameters<typeof t>[0])}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{ borderColor: `${health}40`, color: health }}
              >
                {t(`wbp.health.${wbp.health}` as Parameters<typeof t>[0])}
              </Badge>
            </div>
          </div>
          <ProgressDial value={wbp.progress} color={health} size={64} />
        </div>
        {wbp.description && (
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">{wbp.description}</p>
        )}
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-xcollab-border/50 bg-xcollab-border/40">
        {[
          { label: t('wbp.ownerTeam'), value: wbp.ownerTeam?.name || '—', dot: teamColor },
          { label: t('wbp.progress'), value: `${wbp.progress}%` },
          { label: t('wbp.startDate'), value: formatDate(locale, wbp.startDate) },
          { label: t('wbp.dueDate'), value: formatDate(locale, wbp.dueDate) },
        ].map((cell) => (
          <div key={cell.label} className="bg-xcollab-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">{cell.label}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-[var(--ink-1)] tabular-nums">
              {cell.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cell.dot }} />}
              {cell.value}
            </p>
          </div>
        ))}
      </div>

      {wbp.scope && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            <FileText className="h-3.5 w-3.5" />
            {t('wbp.scope')}
          </h4>
          <p className="text-sm leading-relaxed text-[var(--ink-2)]">{wbp.scope}</p>
        </div>
      )}

      {wbp.tasks.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            <ListChecks className="h-3.5 w-3.5" />
            {t('wbp.tasks')} · {wbp.tasks.length}
          </h4>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pe-1">
            {wbp.tasks.slice(0, 10).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2.5 rounded-lg border border-xcollab-border/30 bg-xcollab-surface-2/60 px-3 py-2 text-sm"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: task.status === 'done' ? '#22C55E' : task.status === 'todo' ? '#3A3A4A' : '#FF4713' }}
                />
                <span className="min-w-0 flex-1 truncate text-[var(--ink-2)]">{task.title}</span>
                <Badge variant={task.status === 'done' ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">
                  {task.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {wbp.milestones.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            <MilestoneIcon className="h-3.5 w-3.5" />
            {t('wbp.milestones')} · {wbp.milestones.length}
          </h4>
          <div className="space-y-0 border-s border-xcollab-border/40 ps-4">
            {wbp.milestones.map((m) => (
              <div key={m.id} className="relative py-2">
                <span
                  className="absolute -start-[21px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-[var(--bg-1)]"
                  style={{ backgroundColor: m.status === 'overdue' ? '#EF4444' : m.status === 'reached' ? '#3B82F6' : '#22C55E' }}
                />
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--ink-2)]">{m.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-[var(--ink-3)] tabular-nums">
                    {m.date ? formatDate(locale, m.date) : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {wbp.risks.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('wbp.risks')} · {wbp.risks.length}
          </h4>
          <div className="space-y-1.5">
            {wbp.risks.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-xcollab-border/30 bg-xcollab-surface-2/60 px-3 py-2 text-sm">
                <Badge variant={SEVERITY_VARIANT[r.severity] || 'secondary'} className="shrink-0 text-[10px] uppercase">
                  {t(`risk.severity.${r.severity}` as Parameters<typeof t>[0])}
                </Badge>
                <span className="min-w-0 truncate text-[var(--ink-2)]">{r.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator className="bg-xcollab-border/40" />
      <ApprovalsBlock wbpId={wbp.id} />
      <Separator className="bg-xcollab-border/40" />
      <DiscussionThread wbpId={wbp.id} />
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side={isRTL(locale) ? 'left' : 'right'} className="w-full bg-xcollab-surface border-xcollab-border p-0 sm:w-[400px]">
          <SheetHeader className="px-5 pb-3 pt-5">
            <SheetTitle className="text-[var(--ink-1)]">{t('wbp.title')}</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-5rem)] overflow-y-auto">
            <div className="p-5">{content}</div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-[420px] shrink-0 border-s border-xcollab-border/60 bg-[var(--bg-1)]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-xcollab-border/60 px-5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-3)]">{wbp.code}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--ink-3)] hover:bg-[var(--ink-1)]/5 hover:text-[var(--ink-1)]"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="p-5">{content}</div>
      </div>
    </motion.div>
  );
}

/* ---- Main view ---- */

function findWbp(list: WBPFlat[], id: string): WBPFlat | null {
  for (const w of list) {
    if (w.id === id) return w;
    const found = findWbp(w.children || [], id);
    if (found) return found;
  }
  return null;
}

export default function WBPExplorerView() {
  const { locale, selectedWbpId, setSelectedWbpId } = useAppStore();
  const { t } = useTranslation(locale);
  const { data, isLoading: loading, error, refetch } = useProgram();
  // null = "user hasn't toggled anything yet" — roots render expanded by default.
  const [expandedIds, setExpandedIds] = useState<Set<string> | null>(null);

  const rootIds = useMemo(() => new Set(data?.wbps.map((w) => w.id) ?? []), [data]);
  const effectiveExpanded = expandedIds ?? rootIds;

  const handleToggle = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev ?? rootIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [rootIds],
  );

  const flat = useMemo(() => {
    const all: WBPFlat[] = [];
    const walk = (w: WBPFlat) => {
      all.push(w);
      w.children?.forEach(walk);
    };
    data?.wbps.forEach(walk);
    return all;
  }, [data]);

  const stats = useMemo(
    () => ({
      total: flat.length,
      inProgress: flat.filter((w) => w.status === 'in-progress').length,
      atRisk: flat.filter((w) => w.health === 'at-risk' || w.health === 'off-track' || w.health === 'behind').length,
      avgProgress: flat.length ? Math.round(flat.reduce((s, w) => s + w.progress, 0) / flat.length) : 0,
    }),
    [flat],
  );

  const selectedWbp = selectedWbpId && data ? findWbp(data.wbps, selectedWbpId) : null;

  if (error) {
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 bg-xcollab-surface-2" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-xcollab-surface-2" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl bg-xcollab-surface-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-9.5rem)] gap-0">
      <div className="min-w-0 flex-1">
        {/* Header + telemetry strip */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1.5 rounded-full bg-[var(--brand)]" />
            <h2 className="text-xl font-bold tracking-tight text-[var(--ink-1)]">{t('wbp.title')}</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: t('timeline.packages'), value: stats.total, color: '#FF4713' },
              { label: t('wbp.status.in-progress'), value: stats.inProgress, color: '#3B82F6' },
              { label: t('wbp.health.at-risk'), value: stats.atRisk, color: '#F59E0B' },
              { label: t('wbp.progress'), value: `${stats.avgProgress}%`, color: '#22C55E' },
            ].map((chip) => (
              <div
                key={chip.label}
                className="flex items-center justify-between rounded-lg border border-xcollab-border/40 bg-xcollab-surface/60 px-3 py-2"
              >
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">{chip.label}</span>
                <span className="font-mono text-base font-bold tabular-nums" style={{ color: chip.color }}>
                  {chip.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-17.5rem)]">
          <div className="pe-2" role="tree" aria-label={t('wbp.title')}>
            {data?.wbps.length === 0 ? (
              <div className="flex flex-col items-center py-20">
                <div className="empty-state-icon">
                  <FolderTree className="h-8 w-8 text-[var(--ink-3)]" />
                </div>
                <p className="text-sm text-[var(--ink-3)]">{t('wbp.noWBPs')}</p>
              </div>
            ) : (
              data?.wbps.map((wbp) => (
                <PackageBay
                  key={wbp.id}
                  wbp={wbp}
                  locale={locale}
                  selectedId={selectedWbpId}
                  expandedIds={effectiveExpanded}
                  onSelect={setSelectedWbpId}
                  onToggle={handleToggle}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {selectedWbp && <DetailPanel wbp={selectedWbp} onClose={() => setSelectedWbpId(null)} />}
    </div>
  );
}
