'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FolderTree, ListChecks, AlertTriangle, Users, TrendingUp, Calendar,
  ShieldAlert, Flag, Inbox, Activity, Network, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Clock, Zap, UserPlus, MessageSquare, GitBranch,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { ProgramDashboardData, DashboardStats, WBPFlat, Activity } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts';

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } } },
};

function computeStats(data: ProgramDashboardData): DashboardStats {
  const allWbps: WBPFlat[] = [];
  const flatten = (w: WBPFlat) => { allWbps.push(w); w.children?.forEach(flatten); };
  data.wbps.forEach(flatten);
  const allTasks = allWbps.flatMap((w) => w.tasks);
  const allRisks = allWbps.flatMap((w) => w.risks);
  return {
    totalWBPs: allWbps.length, completedWBPs: allWbps.filter((w) => w.status === 'completed').length,
    inProgressWBPs: allWbps.filter((w) => w.status === 'in-progress').length,
    atRiskWBPs: allWbps.filter((w) => w.health === 'at-risk' || w.health === 'off-track').length,
    totalTasks: allTasks.length, completedTasks: allTasks.filter((t) => t.status === 'done').length,
    totalRisks: allRisks.length, openRisks: allRisks.filter((r) => r.status === 'open').length,
    teamsCount: data.teams.length, membersCount: data.members.length,
    overallProgress: allWbps.length ? Math.round(allWbps.reduce((s, w) => s + w.progress, 0) / allWbps.length) : 0,
  };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const HEALTH_COLORS: Record<string, string> = { 'on-track': '#22C55E', 'at-risk': '#F59E0B', 'off-track': '#EF4444', completed: '#3B82F6', behind: '#EF4444' };
const SEVERITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = { low: 'secondary', medium: 'outline', high: 'default', critical: 'destructive' };
const SEVERITY_BORDER: Record<string, string> = { low: 'risk-border-low', medium: 'risk-border-medium', high: 'risk-border-high', critical: 'risk-border-critical' };

const MOCK_ACTIVITIES: Activity[] = [
  { id: 'a1', type: 'task_moved', title: 'Task moved to Review', description: 'FIPS 140-2 L4 test vectors moved from In Progress to Review', actorName: 'Charlie Santos', entityType: 'task', entityId: 't1', entityCode: 'WBP-200', timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
  { id: 'a2', type: 'risk_flagged', title: 'Critical risk flagged', description: 'FIPS 140-2 Level 4 lab availability — 6-month lead time', actorName: 'AI Risk Agent', entityType: 'risk', entityId: 'r1', entityCode: 'WBP-600', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: 'a3', type: 'milestone_reached', title: 'Dashboard wireframes approved', description: 'Management Console UI wireframes passed review gate', actorName: 'Diana Kallio', entityType: 'milestone', entityId: 'm1', entityCode: 'WBP-400', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
  { id: 'a4', type: 'task_created', title: 'New task created', description: 'Automated test framework setup added to WBP-500', actorName: 'Emma Zhang', entityType: 'task', entityId: 't2', entityCode: 'WBP-500', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: 'a5', type: 'wbp_updated', title: 'WBP-210 health changed', description: 'Post-Quantum Crypto Module moved from On Track to At Risk', actorName: 'AI Analyst', entityType: 'wbp', entityId: 'w1', entityCode: 'WBP-210', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: 'a6', type: 'member_joined', title: 'New member joined', description: 'Omar Al-Farsi joined Hardware Engineering team', actorName: 'System', entityType: 'member', entityId: 'm1', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
];

const ACTIVITY_ICONS: Record<string, typeof CheckCircle2> = {
  task_moved: GitBranch, risk_flagged: AlertTriangle, milestone_reached: CheckCircle2, task_created: ListChecks, wbp_updated: Zap, member_joined: UserPlus, comment_added: MessageSquare, status_changed: Activity,
};

function hexToRgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '255,71,19';
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DashboardView() {
  const { locale, setProgramData } = useAppStore();
  const { t } = useTranslation(locale);
  const [data, setData] = useState<ProgramDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/program').then((r) => r.json()).then((d) => { setData(d); setProgramData(d.id, d.name); setLoading(false); }).catch(() => setLoading(false));
  }, [setProgramData]);

  const stats = data ? computeStats(data) : null;

  const statCards = stats ? [
    { label: t('dashboard.activeWBPs'), value: stats.totalWBPs, icon: FolderTree, color: '#FF4713', change: '+2 this week', up: true },
    { label: t('dashboard.totalTasks'), value: stats.totalTasks, icon: ListChecks, color: '#3B82F6', change: `${stats.completedTasks} done`, up: true },
    { label: t('dashboard.openRisks'), value: stats.openRisks, icon: AlertTriangle, color: '#F59E0B', change: '+1 new', up: false },
    { label: t('dashboard.teams'), value: stats.teamsCount, icon: Users, color: '#22C55E', change: `${stats.membersCount} members`, up: true },
  ] : [];

  const allWbps: WBPFlat[] = [];
  if (data) { const f = (w: WBPFlat) => { allWbps.push(w); w.children?.forEach(f); }; data.wbps.forEach(f); }

  const healthCounts = allWbps.reduce((a, w) => { a[w.health] = (a[w.health] || 0) + 1; return a; }, {} as Record<string, number>);
  const allMilestones = allWbps.flatMap((w) => w.milestones).filter((m) => m.status === 'upcoming' || m.status === 'overdue');
  const allRisks = allWbps.flatMap((w) => w.risks).filter((r) => r.status === 'open');

  // Chart data
  const teamChartData = data?.teams.map((team) => {
    const tw = allWbps.filter((w) => w.ownerTeamId === team.id);
    const total = tw.reduce((s, w) => s + w.tasks.length, 0);
    const done = tw.reduce((s, w) => s + w.tasks.filter((t) => t.status === 'done').length, 0);
    return { name: team.name.split(' ')[0], total, done, pending: total - done, color: team.color };
  });

  const healthPieData = Object.entries(HEALTH_COLORS).map(([h, c]) => ({ name: h.replace('-', ' '), value: healthCounts[h] || 0, color: c })).filter((d) => d.value > 0);

  const burndownData = useMemo(() => {
    const weeks = 12;
    const start = new Date('2026-01-15');
    return Array.from({ length: weeks }, (_, i) => {
      const weekStart = new Date(start); weekStart.setDate(weekStart.getDate() + i * 7);
      const label = `W${i + 1}`;
      const ideal = Math.max(100 - (i / weeks) * 100, 0);
      const actual = Math.max(100 - (i / weeks) * 85 + Math.sin(i * 0.8) * 8 - i * 1.5, 10);
      return { label, ideal: Math.round(ideal), actual: Math.round(actual) };
    });
  }, []);

  const maxTasks = Math.max(...(teamChartData?.map((tw) => tw.total) || [1]), 1);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-xcollab-surface-2" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-32 bg-xcollab-surface-2 rounded-xl" />))}</div>
        <Skeleton className="h-48 bg-xcollab-surface-2 rounded-xl" />
      </div>
    );
  }

  if (!data || !stats) {
    return (<div className="flex flex-col items-center justify-center py-24"><div className="empty-state-icon"><Inbox className="w-8 h-8 text-[#71717A]" /></div><p className="text-sm text-[#71717A] mt-2">{t('common.noData')}</p></div>);
  }

  return (
    <motion.div className="space-y-6 max-w-7xl" variants={stagger.container} initial="initial" animate="animate">
      {/* Program header */}
      <motion.div variants={stagger.item}>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-[#E8E8ED] tracking-tight">{t('dashboard.title')}</h2>
          <Badge variant="outline" className="text-[11px] uppercase tracking-wider border-[#FF4713]/30 text-[#FF4713] font-semibold px-2.5 py-0.5 rounded-md">{data.status}</Badge>
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-[#71717A]">
          <span className="flex items-center gap-1.5"><Calendar className="w-[14px] h-[14px]" />{formatDate(data.startDate)} — {formatDate(data.targetDate)}</span>
          <span className="flex items-center gap-1.5"><Users className="w-[14px] h-[14px]" />{data.members.length} members</span>
        </div>
        {data.description && <p className="text-sm text-[#B0B0C0] mt-2 max-w-2xl leading-relaxed">{data.description}</p>}
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} variants={stagger.item}>
              <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth card-hover">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-[#71717A] font-semibold uppercase tracking-wider">{card.label}</p>
                      <p className="text-[30px] font-bold text-[#E8E8ED] mt-1 leading-none tracking-tight">{card.value}</p>
                      <div className={`flex items-center gap-1 mt-1.5 text-[11px] ${card.up ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {card.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>{card.change}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `rgba(${hexToRgb(card.color)}, 0.12)` }}><Icon className="w-[18px] h-[18px]" style={{ color: card.color }} /></div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Overall Progress + Burndown */}
      <div className="grid md:grid-cols-3 gap-6">
        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5"><TrendingUp className="w-[14px] h-[14px] text-[#FF4713]" />{t('dashboard.programProgress')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4"><div className="flex-1 progress-orange"><Progress value={stats.overallProgress} className="h-2.5" /></div><span className="text-sm font-bold text-[#FF4713] tabular-nums">{stats.overallProgress}%</span></div>
              <div className="mt-4 space-y-2.5">
                {data.teams.slice(0, 5).map((team) => {
                  const tw = allWbps.filter((w) => w.ownerTeamId === team.id);
                  const prog = tw.length ? Math.round(tw.reduce((s, w) => s + w.progress, 0) / tw.length) : 0;
                  return (
                    <div key={team.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs"><span className="text-[#B0B0C0]">{team.name.split(' ')[0]}</span><span className="text-[#71717A] tabular-nums">{prog}%</span></div>
                      <div className="h-1.5 rounded-full bg-xcollab-surface-3 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${prog}%`, backgroundColor: team.color }} /></div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item} className="md:col-span-2">
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5"><TrendingUp className="w-[14px] h-[14px] text-[#FF4713]" />Burndown Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={burndownData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs><linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF4713" stopOpacity={0.3} /><stop offset="100%" stopColor="#FF4713" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717A' }} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <RTooltip contentStyle={{ backgroundColor: '#1A1A25', border: '1px solid #2A2A3A', borderRadius: 8, fontSize: 12, color: '#E8E8ED' }} />
                  <Area type="monotone" dataKey="ideal" stroke="#71717A" strokeDasharray="4 4" fill="none" strokeWidth={1.5} name="Ideal" />
                  <Area type="monotone" dataKey="actual" stroke="#FF4713" fill="url(#gradActual)" strokeWidth={2} name="Actual" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Health Pie + Team Bar + Activity Feed */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Health Summary with Pie */}
        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5"><Activity className="w-[14px] h-[14px] text-[#FF4713]" />{t('dashboard.healthSummary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={healthPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none" paddingAngle={3}>
                    {healthPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <RTooltip contentStyle={{ backgroundColor: '#1A1A25', border: '1px solid #2A2A3A', borderRadius: 8, fontSize: 12, color: '#E8E8ED' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {Object.entries(HEALTH_COLORS).map(([health, color]) => {
                  const count = healthCounts[health] || 0;
                  return (<div key={health} className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} /><span className="text-sm text-[#B0B0C0]">{t(`wbp.health.${health}` as Parameters<typeof t>[0])}</span></div><span className="text-sm font-bold text-[#E8E8ED] tabular-nums">{count}</span></div>);
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Task Bar Chart */}
        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5"><Network className="w-[14px] h-[14px] text-[#FF4713]" />Team Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={teamChartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717A' }} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717A' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ backgroundColor: '#1A1A25', border: '1px solid #2A2A3A', borderRadius: 8, fontSize: 12, color: '#E8E8ED' }} />
                  <Bar dataKey="done" stackId="a" fill="#22C55E" radius={[0, 0, 4, 4]} name="Done" />
                  <Bar dataKey="pending" stackId="a" fill="#2A2A3A" radius={[4, 4, 0, 0]} name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Feed */}
        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5"><Clock className="w-[14px] h-[14px] text-[#FF4713]" />Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0 max-h-[300px] overflow-y-auto">
                {MOCK_ACTIVITIES.map((activity, idx) => {
                  const Icon = ACTIVITY_ICONS[activity.type] || Activity;
                  const typeColor = activity.type.includes('risk') ? '#EF4444' : activity.type.includes('milestone') ? '#22C55E' : '#FF4713';
                  return (
                    <div key={activity.id} className={`flex gap-3 py-3 ${idx < MOCK_ACTIVITIES.length - 1 ? 'border-b border-xcollab-border/30' : ''}`}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `rgba(${hexToRgb(typeColor)}, 0.12)` }}><Icon className="w-3.5 h-3.5" style={{ color: typeColor }} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#B0B0C0] leading-snug truncate">{activity.title}</p>
                        <div className="flex items-center gap-2 mt-1"><span className="text-[11px] font-mono text-[#71717A]">{activity.entityCode}</span><span className="text-[11px] text-[#71717A]">·</span><span className="text-[11px] text-[#71717A]">{activity.actorName}</span></div>
                      </div>
                      <span className="text-[11px] text-[#71717A] shrink-0 tabular-nums">{timeAgo(activity.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Milestones + Open Risks */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5"><Flag className="w-[14px] h-[14px] text-[#FF4713]" />{t('dashboard.upcomingMilestones')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 max-h-56 overflow-y-auto">
              {allMilestones.length === 0 ? (<div className="flex flex-col items-center py-8"><Flag className="w-6 h-6 text-[#71717A] mb-2" /><p className="text-sm text-[#71717A]">{t('milestone.noMilestones')}</p></div>) : allMilestones.slice(0, 6).map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3 border-b border-xcollab-border/40 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: m.status === 'overdue' ? '#EF4444' : '#22C55E' }} />
                    <span className="text-sm text-[#B0B0C0] truncate">{m.name}</span>
                  </div>
                  <span className="text-xs text-[#71717A] shrink-0 ms-3">{m.date ? formatDate(m.date) : ''}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item}>
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5"><AlertTriangle className="w-[14px] h-[14px] text-[#F59E0B]" />{t('dashboard.openRisks')}</CardTitle>
            </CardHeader>
            <CardContent>
              {allRisks.length === 0 ? (<div className="flex flex-col items-center py-8"><ShieldAlert className="w-6 h-6 text-[#71717A] mb-2" /><p className="text-sm text-[#71717A]">{t('risk.noRisks')}</p></div>) : (
                <div className="space-y-3 max-h-56 overflow-y-auto">
                  {allRisks.slice(0, 6).map((risk) => (
                    <div key={risk.id} className={`flex items-start gap-3 p-3 rounded-lg bg-xcollab-surface-2 border border-xcollab-border/40 card-hover ${SEVERITY_BORDER[risk.severity] || ''}`}>
                      <Badge variant={SEVERITY_VARIANT[risk.severity] || 'secondary'} className="shrink-0 text-[11px] uppercase tracking-wide">{t(`risk.severity.${risk.severity}` as Parameters<typeof t>[0])}</Badge>
                      <span className="text-sm text-[#B0B0C0] line-clamp-2 leading-relaxed">{risk.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
