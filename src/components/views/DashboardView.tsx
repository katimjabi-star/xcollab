'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderTree,
  ListChecks,
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  ShieldAlert,
  Flag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { ProgramDashboardData, DashboardStats, WBPFlat } from '@/lib/types';

const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.07 } },
  },
  item: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  },
};

function computeStats(data: ProgramDashboardData): DashboardStats {
  const allWbps: WBPFlat[] = [];
  const flatten = (w: WBPFlat) => {
    allWbps.push(w);
    w.children?.forEach(flatten);
  };
  data.wbps.forEach(flatten);

  const allTasks = allWbps.flatMap((w) => w.tasks);
  const allRisks = allWbps.flatMap((w) => w.risks);

  return {
    totalWBPs: allWbps.length,
    completedWBPs: allWbps.filter((w) => w.status === 'completed').length,
    inProgressWBPs: allWbps.filter((w) => w.status === 'in-progress').length,
    atRiskWBPs: allWbps.filter((w) => w.health === 'at-risk' || w.health === 'off-track').length,
    totalTasks: allTasks.length,
    completedTasks: allTasks.filter((t) => t.status === 'done').length,
    totalRisks: allRisks.length,
    openRisks: allRisks.filter((r) => r.status === 'open').length,
    teamsCount: data.teams.length,
    membersCount: data.members.length,
    overallProgress: allWbps.length
      ? Math.round(allWbps.reduce((s, w) => s + w.progress, 0) / allWbps.length)
      : 0,
  };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

const HEALTH_COLORS: Record<string, string> = {
  'on-track': '#22C55E',
  'at-risk': '#F59E0B',
  'off-track': '#EF4444',
  completed: '#3B82F6',
};

const SEVERITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'outline',
  high: 'default',
  critical: 'destructive',
};

export default function DashboardView() {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const [data, setData] = useState<ProgramDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/program')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = data ? computeStats(data) : null;

  const statCards = stats
    ? [
        { label: t('dashboard.activeWBPs'), value: stats.totalWBPs, icon: FolderTree, color: '#FF4713' },
        { label: t('dashboard.totalTasks'), value: stats.totalTasks, icon: ListChecks, color: '#3B82F6' },
        { label: t('dashboard.openRisks'), value: stats.openRisks, icon: AlertTriangle, color: '#F59E0B' },
        { label: t('dashboard.teams'), value: stats.teamsCount, icon: Users, color: '#22C55E' },
      ]
    : [];

  // Flatten all WBPs for health & milestones & risks
  const allWbps: WBPFlat[] = [];
  if (data) {
    const flatten = (w: WBPFlat) => {
      allWbps.push(w);
      w.children?.forEach(flatten);
    };
    data.wbps.forEach(flatten);
  }

  const healthCounts = allWbps.reduce(
    (acc, w) => {
      acc[w.health] = (acc[w.health] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const allMilestones = allWbps.flatMap((w) => w.milestones).filter((m) => m.status === 'upcoming' || m.status === 'overdue');
  const allRisks = allWbps.flatMap((w) => w.risks).filter((r) => r.status === 'open');

  // Team workload: tasks per team
  const teamWorkload = data?.teams.map((team) => {
    const teamWbps = allWbps.filter((w) => w.ownerTeamId === team.id);
    const totalTasks = teamWbps.reduce((s, w) => s + w.tasks.length, 0);
    return { name: team.name, color: team.color, tasks: totalTasks };
  });

  const maxTasks = Math.max(...(teamWorkload?.map((tw) => tw.tasks) || [1]), 1);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-xcollab-surface-2" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 bg-xcollab-surface-2 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 bg-xcollab-surface-2 rounded-xl" />
      </div>
    );
  }

  if (!data || !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8888A0]">{t('common.noData')}</div>
    );
  }

  return (
    <motion.div className="space-y-6 max-w-7xl" variants={stagger.container} initial="initial" animate="animate">
      {/* Program header */}
      <motion.div variants={stagger.item}>
        <h2 className="text-2xl font-bold text-white">{t('dashboard.title')}</h2>
        <div className="flex items-center gap-4 mt-1 text-sm text-[#8888A0]">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(data.startDate)} — {formatDate(data.targetDate)}
          </span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-[#FF4713]/30 text-[#FF4713]">
            {data.status}
          </Badge>
        </div>
        {data.description && (
          <p className="text-sm text-[#8888A0] mt-2 max-w-2xl">{data.description}</p>
        )}
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} variants={stagger.item}>
              <Card className="bg-xcollab-surface border-xcollab-border hover:border-xcollab-border/80 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[#8888A0] font-medium uppercase tracking-wider">
                        {card.label}
                      </p>
                      <p className="text-3xl font-bold text-white mt-1">{card.value}</p>
                    </div>
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${card.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Overall Progress */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#FF4713]" />
              {t('dashboard.programProgress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Progress value={stats.overallProgress} className="h-2.5 flex-1" />
              <span className="text-sm font-bold text-[#FF4713]">{stats.overallProgress}%</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Health Summary */}
        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#FF4713]" />
                {t('dashboard.healthSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(HEALTH_COLORS).map(([health, color]) => {
                const count = healthCounts[health] || 0;
                return (
                  <div key={health} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm text-[#E8E8ED]">
                        {t(`wbp.health.${health}` as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-white">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Workload */}
        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF4713]" />
                {t('dashboard.teams')} — Workload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamWorkload?.map((tw) => (
                <div key={tw.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#E8E8ED] font-medium">{tw.name}</span>
                    <span className="text-[#8888A0]">{tw.tasks} tasks</span>
                  </div>
                  <div className="h-2 rounded-full bg-xcollab-surface-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(tw.tasks / maxTasks) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: tw.color }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Milestones */}
        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-[#FF4713]" />
                {t('dashboard.upcomingMilestones')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-52 overflow-y-auto">
              {allMilestones.length === 0 ? (
                <p className="text-sm text-[#8888A0]">{t('milestone.noMilestones')}</p>
              ) : (
                allMilestones.slice(0, 6).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-1.5 border-b border-xcollab-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-1.5 h-6 rounded-full shrink-0"
                        style={{
                          backgroundColor: m.status === 'overdue' ? '#EF4444' : '#22C55E',
                        }}
                      />
                      <span className="text-sm text-[#E8E8ED] truncate">{m.name}</span>
                    </div>
                    <span className="text-xs text-[#8888A0] shrink-0 ms-2">
                      {m.date ? formatDate(m.date) : ''}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Risks */}
      <motion.div variants={stagger.item}>
        <Card className="bg-xcollab-surface border-xcollab-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              {t('dashboard.openRisks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allRisks.length === 0 ? (
                <p className="text-sm text-[#8888A0]">{t('risk.noRisks')}</p>
              ) : (
                allRisks.slice(0, 6).map((risk) => (
                  <div
                    key={risk.id}
                    className="flex items-start gap-2 p-3 rounded-lg bg-xcollab-surface-2 border border-xcollab-border/50"
                  >
                    <Badge variant={SEVERITY_VARIANT[risk.severity] || 'secondary'} className="shrink-0 text-[10px]">
                      {t(`risk.severity.${risk.severity}` as Parameters<typeof t>[0])}
                    </Badge>
                    <span className="text-sm text-[#E8E8ED] line-clamp-2">{risk.title}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
