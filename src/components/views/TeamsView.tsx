'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Mail, Shield, Crown, UserCircle,
  ChevronRight, Network, Briefcase, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import ErrorState from '@/components/ErrorState';
import { useAppStore } from '@/lib/store';
import { useProgram } from '@/hooks/use-app-data';
import { useTranslation, formatTimeAgo } from '@/lib/i18n';

const ROLE_STYLES: Record<string, { color: string; bg: string; icon: typeof Crown }> = {
  admin: { color: 'var(--brand)', bg: 'color-mix(in srgb, var(--brand) 12%, transparent)', icon: Shield },
  'team-lead': { color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: Crown },
  member: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', icon: UserCircle },
  vendor: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: Briefcase },
};

function getInitials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '113,113,122';
}

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } } },
};

export default function TeamsView() {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const { data, isLoading: loading, error, refetch } = useProgram();
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const teams = data?.teams || [];
  const allMembers = data?.members || [];

  const filteredMembers = allMembers.filter((m) => {
    if (filterRole !== 'all' && m.role !== filterRole) return false;
    if (selectedTeamId && m.teamId !== selectedTeamId) return false;
    return true;
  });

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  if (error) {
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-xcollab-surface-2" />
        <div className="grid md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 bg-xcollab-surface-2 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6 max-w-7xl" variants={stagger.container} initial="initial" animate="animate">
      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-[var(--brand)] rounded-full" />
          <Users className="w-5 h-5 text-[var(--brand)]" />
          <h2 className="text-xl font-bold text-[var(--ink-1)]">{t('nav.teams')}</h2>
          <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[var(--ink-3)]">
            {teams.length} {t('nav.teams')} · {allMembers.length} {t('team.members')}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[140px] h-9 bg-xcollab-surface-2 border-xcollab-border/60 text-sm text-[var(--ink-2)]">
              <Filter className="w-3.5 h-3.5 me-1.5 text-[var(--ink-3)]" />
              <SelectValue placeholder={t('team.allRoles')} />
            </SelectTrigger>
            <SelectContent className="bg-xcollab-surface border-xcollab-border">
              <SelectItem value="all">{t('team.allRoles')}</SelectItem>
              <SelectItem value="admin">{t('team.role.admin')}</SelectItem>
              <SelectItem value="team-lead">{t('team.role.team-lead')}</SelectItem>
              <SelectItem value="member">{t('team.role.member')}</SelectItem>
              <SelectItem value="vendor">{t('team.role.vendor')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Teams sidebar list */}
        <motion.div variants={stagger.item} className="w-[280px] shrink-0 hidden lg:block">
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[var(--ink-1)] flex items-center gap-2.5">
                <Network className="w-[14px] h-[14px] text-[var(--brand)]" />
                {t('nav.teams')} ({teams.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[calc(100vh-16rem)]">
                <div className="px-2 pb-2">
                  <button
                    onClick={() => setSelectedTeamId(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                      !selectedTeamId ? 'bg-[var(--ink-1)]/[0.06] text-[var(--ink-1)]' : 'text-[var(--ink-3)] hover:text-[var(--ink-2)] hover:bg-[var(--ink-1)]/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-xcollab-surface-3 shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium">{t('team.allTeams')}</span>
                    <span className="ms-auto text-xs text-[var(--ink-3)] tabular-nums">{allMembers.length}</span>
                  </button>
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                        selectedTeamId === team.id ? 'bg-[var(--ink-1)]/[0.06] text-[var(--ink-1)]' : 'text-[var(--ink-3)] hover:text-[var(--ink-2)] hover:bg-[var(--ink-1)]/[0.03]'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `rgba(${hexToRgb(team.color)}, 0.15)` }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                      </div>
                      <span className="font-medium truncate">{team.name}</span>
                      <span className="ms-auto text-xs text-[var(--ink-3)] tabular-nums">{team.members.length}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Members grid */}
        <div className="flex-1 min-w-0">
          {selectedTeam && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 mb-4"
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTeam.color, boxShadow: `0 0 10px ${selectedTeam.color}50` }} />
              <span className="text-sm font-semibold text-[var(--ink-1)]">{selectedTeam.name}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--ink-3)]" />
              <span className="text-sm text-[var(--ink-3)]">{filteredMembers.length} {t('team.members')}</span>
            </motion.div>
          )}

          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <div className="empty-state-icon"><Users className="w-8 h-8 text-[var(--ink-3)]" /></div>
              <p className="text-sm text-[var(--ink-3)]">{t('team.noMembers')}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMembers.map((member) => {
                const roleStyle = ROLE_STYLES[member.role] || ROLE_STYLES.member;
                const RoleIcon = roleStyle.icon;
                const teamColor = member.team?.color || '#71717A';

                return (
                  <motion.div
                    key={member.id}
                    variants={stagger.item}
                    whileHover={{ y: -2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth card-hover h-full">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3.5">
                          <Avatar className="h-11 w-11 shrink-0">
                            <AvatarFallback
                              className="text-xs font-bold"
                              style={{ backgroundColor: `rgba(${hexToRgb(teamColor)}, 0.15)`, color: teamColor }}
                            >
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--ink-1)] truncate">{member.name}</p>
                            <p className="text-xs text-[var(--ink-3)] truncate mt-0.5 flex items-center gap-1.5">
                              <Mail className="w-3 h-3" />
                              {member.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                          <Badge
                            className="text-[11px] font-semibold gap-1"
                            style={{ backgroundColor: roleStyle.bg, color: roleStyle.color, borderColor: 'transparent' }}
                          >
                            <RoleIcon className="w-3 h-3" />
                            {ROLE_STYLES[member.role] ? t(`team.role.${member.role}` as Parameters<typeof t>[0]) : member.role.replace('-', ' ')}
                          </Badge>
                          {member.team && (
                            <Badge
                              variant="outline"
                              className="text-[11px] border-xcollab-border/40 text-[var(--ink-3)] gap-1.5"
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.team.color }} />
                              {member.team.name.length > 20 ? member.team.name.slice(0, 20) + '...' : member.team.name}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-xcollab-border/30">
                          <span className="text-[11px] text-[var(--ink-3)]">{t('team.joined').replace('{time}', formatTimeAgo(locale, member.createdAt))}</span>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#22C55E] pulse-dot" />
                            <span className="text-[11px] text-[#22C55E]">{t('common.active')}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
