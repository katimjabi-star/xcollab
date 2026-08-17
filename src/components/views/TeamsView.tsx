'use client';

import { useEffect, useState } from 'react';
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
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { TeamWithMembers, MemberWithTeam, ProgramDashboardData } from '@/lib/types';

const ROLE_STYLES: Record<string, { color: string; bg: string; icon: typeof Crown }> = {
  admin: { color: '#FF4713', bg: 'rgba(255,71,19,0.12)', icon: Shield },
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

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } } },
};

export default function TeamsView() {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const [data, setData] = useState<ProgramDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/program')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const teams = data?.teams || [];
  const allMembers = data?.members || [];

  const filteredMembers = allMembers.filter((m) => {
    if (filterRole !== 'all' && m.role !== filterRole) return false;
    if (selectedTeamId && m.teamId !== selectedTeamId) return false;
    return true;
  });

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

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
          <div className="w-1.5 h-6 bg-[#FF4713] rounded-full" />
          <Users className="w-5 h-5 text-[#FF4713]" />
          <h2 className="text-xl font-bold text-[#E8E8ED]">{t('team.title')}s & Members</h2>
          <Badge variant="outline" className="text-[11px] border-xcollab-border/60 text-[#71717A]">
            {teams.length} {t('team.title')}s · {allMembers.length} {t('team.members')}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[140px] h-9 bg-xcollab-surface-2 border-xcollab-border/60 text-sm text-[#B0B0C0]">
              <Filter className="w-3.5 h-3.5 me-1.5 text-[#71717A]" />
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="bg-xcollab-surface border-xcollab-border">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="team-lead">Team Lead</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Teams sidebar list */}
        <motion.div variants={stagger.item} className="w-[280px] shrink-0 hidden lg:block">
          <Card className="bg-xcollab-surface border-xcollab-border/60 rounded-xl card-glass card-depth">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#E8E8ED] flex items-center gap-2.5">
                <Network className="w-[14px] h-[14px] text-[#FF4713]" />
                {t('team.title')}s ({teams.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[calc(100vh-16rem)]">
                <div className="px-2 pb-2">
                  <button
                    onClick={() => setSelectedTeamId(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                      !selectedTeamId ? 'bg-white/[0.06] text-[#E8E8ED]' : 'text-[#71717A] hover:text-[#B0B0C0] hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-xcollab-surface-3 shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium">All Teams</span>
                    <span className="ms-auto text-xs text-[#71717A] tabular-nums">{allMembers.length}</span>
                  </button>
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                        selectedTeamId === team.id ? 'bg-white/[0.06] text-[#E8E8ED]' : 'text-[#71717A] hover:text-[#B0B0C0] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `rgba(${hexToRgb(team.color)}, 0.15)` }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                      </div>
                      <span className="font-medium truncate">{team.name}</span>
                      <span className="ms-auto text-xs text-[#71717A] tabular-nums">{team.members.length}</span>
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
              <span className="text-sm font-semibold text-[#E8E8ED]">{selectedTeam.name}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />
              <span className="text-sm text-[#71717A]">{filteredMembers.length} {t('team.members')}</span>
            </motion.div>
          )}

          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <div className="empty-state-icon"><Users className="w-8 h-8 text-[#71717A]" /></div>
              <p className="text-sm text-[#71717A]">No members found</p>
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
                            <p className="text-sm font-semibold text-[#E8E8ED] truncate">{member.name}</p>
                            <p className="text-xs text-[#71717A] truncate mt-0.5 flex items-center gap-1.5">
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
                            {member.role.replace('-', ' ')}
                          </Badge>
                          {member.team && (
                            <Badge
                              variant="outline"
                              className="text-[11px] border-xcollab-border/40 text-[#71717A] gap-1.5"
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.team.color }} />
                              {member.team.name.length > 20 ? member.team.name.slice(0, 20) + '...' : member.team.name}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-xcollab-border/30">
                          <span className="text-[11px] text-[#71717A]">Joined {timeAgo(member.createdAt)}</span>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#22C55E] pulse-dot" />
                            <span className="text-[11px] text-[#22C55E]">Active</span>
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
