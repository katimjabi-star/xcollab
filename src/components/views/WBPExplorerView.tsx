'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Circle,
  X,
  Calendar,
  User,
  AlertTriangle,
  FolderTree,
  MilestoneIcon,
  ListChecks,
  FileText,
  Inbox,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAppStore } from '@/lib/store';
import { useTranslation, isRTL } from '@/lib/i18n';
import type { WBPFlat, ProgramDashboardData } from '@/lib/types';

const HEALTH_COLORS: Record<string, string> = {
  'on-track': '#22C55E',
  'at-risk': '#F59E0B',
  'off-track': '#EF4444',
  completed: '#3B82F6',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  planned: 'outline',
  'in-progress': 'default',
  completed: 'secondary',
  'on-hold': 'outline',
  cancelled: 'destructive',
};

const SEVERITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'outline',
  high: 'default',
  critical: 'destructive',
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface WBPNodeProps {
  wbp: WBPFlat;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

function WBPNode({ wbp, depth, selectedId, expandedIds, onSelect, onToggle }: WBPNodeProps) {
  const hasChildren = wbp.children && wbp.children.length > 0;
  const isExpanded = expandedIds.has(wbp.id);
  const isSelected = selectedId === wbp.id;
  const teamColor = wbp.ownerTeam?.color || '#71717A';

  return (
    <div>
      <div
        className={`group flex items-center gap-2 rounded-lg cursor-pointer transition-all duration-150 ${
          isSelected
            ? 'bg-white/[0.06] border border-[#FF4713]/20'
            : 'hover:bg-white/[0.03] border border-transparent'
        }`}
        style={{ paddingInlineStart: `${depth * 24 + 12}px`, paddingBlock: '10px', paddingInlineEnd: '12px' }}
        onClick={() => onSelect(wbp.id)}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {/* Team color strip */}
        <span className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />

        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            className="w-5 h-5 flex items-center justify-center text-[#71717A] hover:text-[#E8E8ED] shrink-0 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(wbp.id);
            }}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Health dot — bigger */}
        <Circle
          className="w-3 h-3 shrink-0 fill-current"
          style={{ color: HEALTH_COLORS[wbp.health] || '#71717A' }}
        />

        {/* Code */}
        <span className="text-xs font-mono text-[#71717A] shrink-0 w-16 truncate">
          {wbp.code}
        </span>

        {/* Name */}
        <span className="text-sm text-[#B0B0C0] group-hover:text-[#E8E8ED] truncate flex-1 transition-colors">{wbp.name}</span>

        {/* Status badge */}
        <Badge
          variant={STATUS_VARIANT[wbp.status] || 'outline'}
          className="text-[11px] shrink-0 hidden xl:inline-flex"
        >
          {wbp.status}
        </Badge>

        {/* Progress mini bar */}
        <div className="w-16 h-1.5 rounded-full bg-xcollab-surface-3 overflow-hidden shrink-0 hidden md:block">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${wbp.progress}%`,
              backgroundColor: HEALTH_COLORS[wbp.health] || '#FF4713',
            }}
          />
        </div>
        <span className="text-xs text-[#71717A] w-8 text-end shrink-0 hidden md:block tabular-nums">
          {wbp.progress}%
        </span>
      </div>

      {/* Children with tree lines */}
      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden relative"
          >
            {/* Vertical tree line */}
            <div
              className="absolute top-0 bottom-0 border-s border-xcollab-border/30"
              style={{ insetInlineStart: `${depth * 24 + 20}px` }}
            />
            {wbp.children.map((child) => (
              <WBPNode
                key={child.id}
                wbp={child}
                depth={depth + 1}
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

/* ---- Detail Panel ---- */
interface DetailPanelProps {
  wbp: WBPFlat;
  onClose: () => void;
}

function DetailPanel({ wbp, onClose }: DetailPanelProps) {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const teamColor = wbp.ownerTeam?.color || '#71717A';

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-[#71717A]">{wbp.code}</span>
          <Badge variant={STATUS_VARIANT[wbp.status] || 'outline'} className="text-[11px]">
            {t(`wbp.status.${wbp.status}` as Parameters<typeof t>[0])}
          </Badge>
          <Badge variant="outline" className="text-[11px] border-[#F59E0B]/40 text-[#F59E0B]">
            {t(`wbp.priority.${wbp.priority}` as Parameters<typeof t>[0])}
          </Badge>
        </div>
        <h3 className="text-lg font-bold text-[#E8E8ED] leading-tight">{wbp.name}</h3>
        {wbp.description && (
          <p className="text-sm text-[#B0B0C0] mt-2 leading-relaxed">{wbp.description}</p>
        )}
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold">{t('wbp.progress')}</span>
          <span className="text-sm font-bold text-[#E8E8ED] tabular-nums">{wbp.progress}%</span>
        </div>
        <div className="progress-orange">
          <Progress value={wbp.progress} className="h-2" />
        </div>
      </div>

      <Separator className="bg-xcollab-border/60" />

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2.5 text-[#B0B0C0]">
          <Circle className="w-3 h-3 fill-current" style={{ color: HEALTH_COLORS[wbp.health] }} />
          <span>{t(`wbp.health.${wbp.health}` as Parameters<typeof t>[0])}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[#B0B0C0]">
          <User className="w-[14px] h-[14px]" />
          <span className="text-[#E8E8ED]">{wbp.ownerTeam?.name || '—'}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[#B0B0C0]">
          <Calendar className="w-[14px] h-[14px]" />
          <span>{formatDate(wbp.startDate)}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[#B0B0C0]">
          <Calendar className="w-[14px] h-[14px]" />
          <span>{formatDate(wbp.dueDate)}</span>
        </div>
      </div>

      {wbp.scope && (
        <>
          <Separator className="bg-xcollab-border/60" />
          <div>
            <h4 className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold mb-2 flex items-center gap-2 section-accent">
              <FileText className="w-[14px] h-[14px]" />
              {t('wbp.scope')}
            </h4>
            <p className="text-sm text-[#B0B0C0] leading-relaxed">{wbp.scope}</p>
          </div>
        </>
      )}

      {/* Tasks summary */}
      {wbp.tasks.length > 0 && (
        <>
          <Separator className="bg-xcollab-border/60" />
          <div>
            <h4 className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold mb-3 flex items-center gap-2 section-accent">
              <ListChecks className="w-[14px] h-[14px]" />
              {t('wbp.tasks')} ({wbp.tasks.length})
            </h4>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {wbp.tasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-xcollab-surface-2 border border-xcollab-border/30 text-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
                  <span className="text-[#B0B0C0] truncate flex-1">{task.title}</span>
                  <Badge variant={task.status === 'done' ? 'secondary' : 'outline'} className="text-[11px] shrink-0">
                    {task.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Milestones */}
      {wbp.milestones.length > 0 && (
        <>
          <Separator className="bg-xcollab-border/60" />
          <div>
            <h4 className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold mb-3 flex items-center gap-2 section-accent">
              <MilestoneIcon className="w-[14px] h-[14px]" />
              {t('wbp.milestones')} ({wbp.milestones.length})
            </h4>
            <div className="space-y-2">
              {wbp.milestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[#B0B0C0]">{m.name}</span>
                  <span className="text-xs text-[#71717A]">{m.date ? formatDate(m.date) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Risks */}
      {wbp.risks.length > 0 && (
        <>
          <Separator className="bg-xcollab-border/60" />
          <div>
            <h4 className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold mb-3 flex items-center gap-2 section-accent">
              <AlertTriangle className="w-[14px] h-[14px]" />
              {t('wbp.risks')} ({wbp.risks.length})
            </h4>
            <div className="space-y-2">
              {wbp.risks.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 py-2 text-sm">
                  <Badge variant={SEVERITY_VARIANT[r.severity] || 'secondary'} className="text-[11px] shrink-0">
                    {r.severity}
                  </Badge>
                  <span className="text-[#B0B0C0] truncate">{r.title}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop panel */}
      <div className="hidden lg:block w-[420px] shrink-0 border-s border-xcollab-border/60 bg-[#0D0D14]">
        <div className="flex items-center justify-between px-5 h-12 border-b border-xcollab-border/60 shrink-0">
          <span className="text-sm font-semibold text-[#E8E8ED]">{t('wbp.title')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="p-5">{content}</div>
        </ScrollArea>
      </div>

      {/* Mobile sheet */}
      <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side={isRTL(locale) ? 'left' : 'right'} className="w-full sm:w-[400px] bg-xcollab-surface border-xcollab-border p-0">
          <SheetHeader className="px-5 pt-5 pb-3">
            <SheetTitle className="text-[#E8E8ED]">{t('wbp.title')}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-5rem)]">
            <div className="p-5">{content}</div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ---- Main View ---- */

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
  const [data, setData] = useState<ProgramDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/program')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Auto-expand root level
        setExpandedIds(new Set(d.wbps.map((w: WBPFlat) => w.id)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedWbp = selectedWbpId && data ? findWbp(data.wbps, selectedWbpId) : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-xcollab-surface-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 bg-xcollab-surface-2 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-9.5rem)]">
      {/* Tree panel */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-[#FF4713] rounded-full" />
          <h2 className="text-xl font-bold text-[#E8E8ED]">{t('wbp.title')}</h2>
          {data && (
            <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[#71717A]">
              {data.wbps.length} packages
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[calc(100vh-14rem)]">
          <div className="space-y-0.5 pr-2">
            {data?.wbps.length === 0 ? (
              <div className="flex flex-col items-center py-20">
                <div className="empty-state-icon">
                  <FolderTree className="w-8 h-8 text-[#71717A]" />
                </div>
                <p className="text-sm text-[#71717A]">{t('wbp.noWBPs')}</p>
              </div>
            ) : (
              data?.wbps.map((wbp) => (
                <WBPNode
                  key={wbp.id}
                  wbp={wbp}
                  depth={0}
                  selectedId={selectedWbpId}
                  expandedIds={expandedIds}
                  onSelect={setSelectedWbpId}
                  onToggle={handleToggle}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detail Panel */}
      {selectedWbp && (
        <DetailPanel wbp={selectedWbp} onClose={() => setSelectedWbpId(null)} />
      )}
    </div>
  );
}
