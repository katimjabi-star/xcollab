'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GanttChart, ZoomIn, ZoomOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { WBPFlat, ProgramDashboardData } from '@/lib/types';

const HEALTH_COLORS: Record<string, string> = {
  'on-track': '#22C55E',
  'at-risk': '#F59E0B',
  'off-track': '#EF4444',
  completed: '#3B82F6',
  behind: '#EF4444',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  const [data, setData] = useState<ProgramDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetch('/api/program')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const flatWbps = useMemo(() => (data ? flattenWbps(data.wbps) : []), [data]);

  const programStart = data?.startDate ? new Date(data.startDate) : new Date('2026-01-01');
  const programEnd = data?.targetDate ? new Date(data.targetDate) : new Date('2026-12-31');
  const totalDays = (programEnd.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24);
  const rowHeight = 48;
  const labelWidth = 320;

  const todayMs = Date.now();
  const todayX = ((todayMs - programStart.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;

  const getBarX = (date: string | null) => {
    if (!date) return 0;
    return ((new Date(date).getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  };
  const getBarWidth = (start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    return Math.max(((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100, 1);
  };

  const monthMarkers = useMemo(() => {
    const markers: { label: string; x: number }[] = [];
    const d = new Date(programStart.getFullYear(), programStart.getMonth(), 1);
    while (d <= programEnd) {
      const x = ((d.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
      markers.push({ label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, x });
      d.setMonth(d.getMonth() + 1);
    }
    return markers;
  }, [programStart, programEnd, totalDays]);

  const chartWidth = 1200;

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
            <div className="w-1.5 h-6 bg-[#FF4713] rounded-full" />
            <GanttChart className="w-5 h-5 text-[#FF4713]" />
            <h2 className="text-xl font-bold text-[#E8E8ED]">Program Timeline</h2>
            <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[#71717A]">
              {flatWbps.length} packages
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5" onClick={() => setZoom((z) => Math.min(z + 0.25, 2))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-[#71717A] tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Timeline chart */}
        <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth overflow-hidden">
          <ScrollArea className="w-full">
            <div style={{ minWidth: chartWidth }}>
              {/* Month header row */}
              <div className="flex border-b border-xcollab-border/40" style={{ paddingLeft: labelWidth }}>
                {monthMarkers.map((m) => (
                  <div
                    key={m.label}
                    className="text-[11px] text-[#71717A] font-medium shrink-0 border-s border-xcollab-border/20 px-3 py-2"
                    style={{ width: `${100 / monthMarkers.length}%` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="relative">
                {/* Today vertical line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-[#FF4713]/40 z-10 pointer-events-none"
                  style={{ left: `${labelWidth + (todayX / 100) * (chartWidth - labelWidth)}px` }}
                />
                <div
                  className="absolute top-0 z-20 text-[10px] text-[#FF4713] font-bold bg-[#FF4713] px-2 py-0.5 rounded-b-md"
                  style={{ left: `${labelWidth + (todayX / 100) * (chartWidth - labelWidth) - 16}px` }}
                >
                  TODAY
                </div>

                {flatWbps.map((wbp) => {
                  const barX = getBarX(wbp.startDate);
                  const barW = getBarWidth(wbp.startDate, wbp.dueDate);
                  const healthColor = HEALTH_COLORS[wbp.health] || '#71717A';
                  const teamColor = wbp.ownerTeam?.color || '#71717A';

                  return (
                    <div
                      key={wbp.id}
                      className="flex items-center border-b border-xcollab-border/20 hover:bg-white/[0.02] transition-colors"
                      style={{ height: rowHeight }}
                    >
                      {/* Label */}
                      <div
                        className="shrink-0 flex items-center gap-2.5 px-4 border-e border-xcollab-border/30"
                        style={{ width: labelWidth, paddingInlineStart: `${wbp.depth * 20 + 16}px` }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
                        <span className="text-xs font-mono text-[#71717A] shrink-0 w-14">{wbp.code}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-[#B0B0C0] truncate cursor-default hover:text-[#E8E8ED] transition-colors">{wbp.name}</span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-xcollab-surface-2 text-[#E8E8ED] border-xcollab-border max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold">{wbp.code} - {wbp.name}</p>
                              <p className="text-xs text-[#B0B0C0]">{wbp.description || 'No description'}</p>
                              <div className="flex gap-2 text-[11px]">
                                <span style={{ color: healthColor }}>{wbp.health}</span>
                                <span className="text-[#71717A]">|</span>
                                <span>{wbp.progress}%</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Timeline bar area */}
                      <div className="flex-1 relative h-full">
                        {wbp.startDate && wbp.dueDate && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md overflow-hidden group cursor-pointer"
                            style={{
                              left: `${barX}%`,
                              width: `${barW}%`,
                              backgroundColor: `${healthColor}20`,
                              border: `1px solid ${healthColor}40`,
                            }}
                          >
                            <div
                              className="h-full rounded-s-md transition-all duration-500"
                              style={{ width: `${wbp.progress}%`, backgroundColor: `${healthColor}60` }}
                            />
                            {wbp.progress > 15 && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#E8E8ED]">{wbp.progress}%</span>
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
