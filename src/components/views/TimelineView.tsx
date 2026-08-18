'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GanttChart, ZoomIn, ZoomOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import ErrorState from '@/components/ErrorState';
import { useAppStore } from '@/lib/store';
import { useProgram } from '@/hooks/use-app-data';
import { useTranslation } from '@/lib/i18n';
import type { WBPFlat } from '@/lib/types';

const HEALTH_COLORS: Record<string, string> = {
  'on-track': '#22C55E',
  'at-risk': '#F59E0B',
  'off-track': '#EF4444',
  completed: '#3B82F6',
  behind: '#EF4444',
};

function flattenWbps(list: WBPFlat[]): (WBPFlat & { depth: number })[] {
  const result: (WBPFlat & { depth: number })[] = [];
  const walk = (w: WBPFlat, depth: number) => {
    result.push({ ...w, depth });
    w.children?.forEach((c) => walk(c, depth + 1));
  };
  list.forEach((w) => walk(w, 0));
  return result;
}

export default function TimelineView() {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const { data, isLoading: loading, error, refetch } = useProgram();
  const [zoom, setZoom] = useState(1);

  const flatWbps = useMemo(() => (data ? flattenWbps(data.wbps) : []), [data]);

  const { programStart, programEnd, totalDays } = useMemo(() => {
    const start = data?.startDate ? new Date(data.startDate) : new Date('2026-01-01');
    const end = data?.targetDate ? new Date(data.targetDate) : new Date('2026-12-31');
    return {
      programStart: start,
      programEnd: end,
      totalDays: Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), 1),
    };
  }, [data]);

  const rowHeight = 48;
  const labelWidth = 320;

  const toPercent = (ms: number) =>
    ((ms - programStart.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;

  const todayX = toPercent(Date.now());
  const todayVisible = todayX >= 0 && todayX <= 100;

  // Positions bars, month markers, and the today line in the same coordinate
  // system: percentage of the bar area, offset past the fixed label column.
  // Using calc() keeps everything aligned no matter how wide the chart renders.
  const timelineLeft = (percent: number) =>
    `calc(${labelWidth}px + (100% - ${labelWidth}px) * ${percent / 100})`;

  const getBar = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const rawX = toPercent(new Date(start).getTime());
    const rawEnd = toPercent(new Date(end).getTime());
    // Entirely outside the program window — no bar rather than a phantom sliver
    if (rawEnd < 0 || rawX > 100) return null;
    const x = Math.min(Math.max(rawX, 0), 100);
    const width = Math.max(Math.min(rawEnd, 100) - x, 1);
    return { x, width };
  };

  const monthMarkers = useMemo(() => {
    const monthFormat = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { month: 'short', year: 'numeric' });
    const markers: { label: string; x: number }[] = [];
    const d = new Date(programStart.getFullYear(), programStart.getMonth(), 1);
    while (d <= programEnd) {
      const x = ((d.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
      if (x >= 0 && x <= 100) {
        markers.push({ label: monthFormat.format(d), x });
      }
      d.setMonth(d.getMonth() + 1);
    }
    return markers;
  }, [programStart, programEnd, totalDays, locale]);

  const chartWidth = Math.round(1200 * zoom);

  if (error) {
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-xcollab-surface-2" />
        <Skeleton className="h-[500px] bg-xcollab-surface-2 rounded-xl" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[var(--brand)] rounded-full" />
            <GanttChart className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="text-xl font-bold text-[var(--ink-1)]">{t('timeline.title')}</h2>
            <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[var(--ink-3)]">
              {flatWbps.length} {t('timeline.packages')}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--ink-1)]/5" onClick={() => setZoom((z) => Math.min(z + 0.25, 2))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--ink-1)]/5" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-[var(--ink-3)] tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Timeline chart */}
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth overflow-hidden">
          <ScrollArea className="w-full">
            <div style={{ minWidth: chartWidth }}>
              {/* Month header row */}
              <div className="relative h-8 border-b border-xcollab-border/40">
                {monthMarkers.map((m) => (
                  <div
                    key={m.label}
                    className="absolute top-0 bottom-0 flex items-center text-[11px] text-[var(--ink-3)] font-medium border-s border-xcollab-border/20 ps-2 whitespace-nowrap"
                    style={{ insetInlineStart: timelineLeft(m.x) }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="relative">
                {/* Today vertical line */}
                {todayVisible && (
                  <>
                    <div
                      className="absolute top-0 bottom-0 w-px bg-[var(--brand)]/40 z-10 pointer-events-none"
                      style={{ insetInlineStart: timelineLeft(todayX) }}
                    />
                    <div
                      className="absolute top-0 z-20 -translate-x-1/2 rtl:translate-x-1/2 text-[10px] text-white font-bold bg-[var(--brand)] px-2 py-0.5 rounded-b-md"
                      style={{ insetInlineStart: timelineLeft(todayX) }}
                    >
                      <span className="uppercase">{t('common.today')}</span>
                    </div>
                  </>
                )}

                {flatWbps.map((wbp) => {
                  const bar = getBar(wbp.startDate, wbp.dueDate);
                  const healthColor = HEALTH_COLORS[wbp.health] || '#71717A';
                  const teamColor = wbp.ownerTeam?.color || '#71717A';

                  return (
                    <div
                      key={wbp.id}
                      className="flex items-center border-b border-xcollab-border/20 hover:bg-[var(--ink-1)]/[0.02] transition-colors"
                      style={{ height: rowHeight }}
                    >
                      {/* Label */}
                      <div
                        className="shrink-0 flex items-center gap-2.5 px-4 border-e border-xcollab-border/30"
                        style={{ width: labelWidth, paddingInlineStart: `${wbp.depth * 20 + 16}px` }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
                        <span className="text-xs font-mono text-[var(--ink-3)] shrink-0 w-14">{wbp.code}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-[var(--ink-2)] truncate cursor-default hover:text-[var(--ink-1)] transition-colors">{wbp.name}</span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-xcollab-surface-2 text-[var(--ink-1)] border-xcollab-border max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold">{wbp.code} - {wbp.name}</p>
                              <p className="text-xs text-[var(--ink-2)]">{wbp.description || t('common.noDescription')}</p>
                              <div className="flex gap-2 text-[11px]">
                                <span style={{ color: healthColor }}>{wbp.health}</span>
                                <span className="text-[var(--ink-3)]">|</span>
                                <span>{wbp.progress}%</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Timeline bar area */}
                      <div className="flex-1 relative h-full">
                        {bar && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md overflow-hidden group cursor-pointer"
                            style={{
                              insetInlineStart: `${bar.x}%`,
                              width: `${bar.width}%`,
                              backgroundColor: `${healthColor}20`,
                              border: `1px solid ${healthColor}40`,
                            }}
                          >
                            <div
                              className="h-full rounded-s-md transition-all duration-500"
                              style={{ width: `${wbp.progress}%`, backgroundColor: `${healthColor}60` }}
                            />
                            {wbp.progress > 15 && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--ink-1)]">{wbp.progress}%</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
}
