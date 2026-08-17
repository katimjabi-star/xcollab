'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FolderTree, Columns3, ArrowRightLeft, Bot, Shield,
  ChevronLeft, ChevronRight, Users, GanttChart, Settings,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { useTranslation, isRTL } from '@/lib/i18n';
import type { ViewType } from '@/lib/types';
import type { ProgramDashboardData } from '@/lib/types';

const NAV_ITEMS: { view: ViewType; icon: LucideIcon; labelKey: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { view: 'wbp', icon: FolderTree, labelKey: 'nav.wbp' },
  { view: 'kanban', icon: Columns3, labelKey: 'nav.kanban' },
  { view: 'timeline', icon: GanttChart, labelKey: 'nav.timeline' },
  { view: 'dependencies', icon: ArrowRightLeft, labelKey: 'nav.dependencies' },
  { view: 'teams', icon: Users, labelKey: 'nav.teams' },
  { view: 'ai-chat', icon: Bot, labelKey: 'nav.aiChat' },
];

export default function AppSidebar() {
  const { currentView, sidebarCollapsed, locale, setView, toggleSidebar, programName } = useAppStore();
  const { t } = useTranslation(locale);
  const rtl = isRTL(locale);

  const navButton = (item: (typeof NAV_ITEMS)[number]) => {
    const isActive = currentView === item.view;
    const Icon = item.icon;
    return (
      <button
        key={item.view}
        onClick={() => setView(item.view)}
        className={`
          group relative flex items-center w-full rounded-lg transition-all duration-200
          ${isActive ? 'bg-white/[0.06] text-[#E8E8ED]' : 'text-[#71717A] hover:text-[#B0B0C0] hover:bg-white/[0.03]'}
        `}
        style={{ paddingInlineStart: sidebarCollapsed ? '0' : undefined }}
      >
        {isActive && (
          <motion.div
            layoutId="sidebar-active-bar"
            className="absolute rounded-full bg-[#FF4713]"
            style={{ width: '2px', height: '20px', ...(rtl ? { right: 0 } : { left: 0 }) }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        <span
          className={`flex items-center justify-center shrink-0 transition-colors duration-200 ${
            isActive ? 'text-[#FF4713]' : 'text-[#71717A] group-hover:text-[#B0B0C0]'
          }`}
          style={{ width: sidebarCollapsed ? '64px' : '40px', height: '40px' }}
        >
          <Icon className="w-5 h-5" />
        </span>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap text-sm font-medium"
            >
              {t(item.labelKey as Parameters<typeof t>[0])}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 256 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col h-screen border-r border-xcollab-border/60 bg-[#0D0D14] overflow-hidden shrink-0 z-30"
      >
        {/* Logo + Tagline */}
        <div className="flex items-center gap-3 px-4 shrink-0" style={{ height: '64px' }}>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#FF4713] shrink-0 shadow-[0_0_12px_rgba(255,71,19,0.3)]">
            <Shield className="w-[18px] h-[18px] text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="text-base font-bold tracking-tight">
                  <span className="text-[#E8E8ED]">X</span><span className="text-[#FF4713] text-glow">Collab</span>
                </span>
                <p className="text-[11px] text-[#71717A] font-medium -mt-0.5">EDGE Group</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mx-3 border-t border-xcollab-border/60" />

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 gap-1 flex flex-col overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const btn = navButton(item);
            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.view}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side={rtl ? 'right' : 'left'} className="bg-xcollab-surface-2 text-[#E8E8ED] border-xcollab-border">{t(item.labelKey as Parameters<typeof t>[0])}</TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })}
        </nav>

        <div className="mx-3 border-t border-xcollab-border/60" />

        {/* Teams Section */}
        <div className="py-3 px-4 shrink-0">
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3">
                <p className="text-[11px] uppercase tracking-widest text-[#71717A] font-semibold">Teams</p>
              </motion.div>
            )}
          </AnimatePresence>
          <SidebarTeams collapsed={sidebarCollapsed} rtl={rtl} />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-[#71717A] mt-3 font-medium">{programName}</motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom: Settings + Collapse */}
        <div className="shrink-0 border-t border-xcollab-border/60">
          {!sidebarCollapsed && (
            <button
              onClick={() => setView('settings')}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${currentView === 'settings' ? 'text-[#E8E8ED]' : 'text-[#71717A] hover:text-[#B0B0C0]'}`}
            >
              <Settings className="w-5 h-5" />
              <span>{t('nav.settings')}</span>
            </button>
          )}
          <div className="p-2">
            <Button
              variant="ghost" size="sm" onClick={toggleSidebar}
              className="w-full justify-center text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5"
              aria-label={sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            >
              {sidebarCollapsed ? (rtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : (rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />)}
            </Button>
          </div>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

function SidebarTeams({ collapsed, rtl }: { collapsed: boolean; rtl: boolean }) {
  const { locale } = useAppStore();
  const [teams, setTeams] = useState<{ id: string; name: string; color: string }[]>([]);

  useEffect(() => {
    fetch('/api/program').then((r) => r.json()).then((data: ProgramDashboardData) => {
      if (data?.teams) setTeams(data.teams.map((t) => ({ id: t.id, name: t.name, color: t.color })));
    }).catch(() => {});
  }, []);

  if (teams.length === 0) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className={`flex ${collapsed ? 'flex-col gap-2 items-center' : 'flex-wrap gap-2'}`}>
        {teams.map((team) => (
          <Tooltip key={team.id}>
            <TooltipTrigger asChild>
              <div className="w-3 h-3 rounded-full cursor-pointer transition-transform hover:scale-125" style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}40` }} />
            </TooltipTrigger>
            <TooltipContent side={rtl ? 'right' : 'left'} className="bg-xcollab-surface-2 text-[#E8E8ED] border-xcollab-border">{team.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
