'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderTree,
  Columns3,
  GitBranch,
  Bot,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { useTranslation, isRTL } from '@/lib/i18n';
import type { ViewType } from '@/lib/types';

const NAV_ITEMS: { view: ViewType; icon: typeof LayoutDashboard; labelKey: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { view: 'wbp', icon: FolderTree, labelKey: 'nav.wbp' },
  { view: 'kanban', icon: Columns3, labelKey: 'nav.kanban' },
  { view: 'dependencies', icon: GitBranch, labelKey: 'nav.dependencies' },
  { view: 'ai-chat', icon: Bot, labelKey: 'nav.aiChat' },
];

const TEAM_COLORS = ['#FF4713', '#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#EC4899'];
const TEAM_NAMES = ['Cyber Ops', 'Engineering', 'Comms', 'Logistics', 'Intel', 'QA'];

export default function AppSidebar() {
  const { currentView, sidebarCollapsed, locale, setView, toggleSidebar } = useAppStore();
  const { t } = useTranslation(locale);
  const rtl = isRTL(locale);

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 256 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col h-screen border-r border-xcollab-border bg-[#0D0D14] overflow-hidden shrink-0 z-30"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FF4713] shrink-0">
            <Shield className="w-4 h-4 text-white" />
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
                <span className="text-lg font-bold tracking-tight">
                  <span className="text-white">X</span>
                  <span className="text-[#FF4713] text-glow">Collab</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Separator className="bg-xcollab-border" />

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.view;
            const Icon = item.icon;
            const navButton = (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`
                  group relative flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-[#FF4713]/10 text-[#FF4713]'
                    : 'text-[#8888A0] hover:text-white hover:bg-white/5'
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg border border-[#FF4713]/20"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className={`w-5 h-5 shrink-0 relative z-10 ${isActive ? 'text-[#FF4713]' : ''}`} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden whitespace-nowrap relative z-10"
                    >
                      {t(item.labelKey as Parameters<typeof t>[0])}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.view}>
                  <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                  <TooltipContent side={rtl ? 'right' : 'left'} className="bg-xcollab-surface-2 text-white border-xcollab-border">
                    {t(item.labelKey as Parameters<typeof t>[0])}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navButton;
          })}
        </nav>

        <Separator className="bg-xcollab-border" />

        {/* Teams */}
        <div className="py-3 px-4 shrink-0">
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-2"
              >
                <p className="text-[10px] uppercase tracking-widest text-[#8888A0] font-semibold mb-2">
                  Teams
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className={`flex ${sidebarCollapsed ? 'flex-col gap-2 items-center' : 'flex-wrap gap-2'}`}>
            {TEAM_COLORS.map((color, i) => (
              <Tooltip key={TEAM_NAMES[i]}>
                <TooltipTrigger asChild>
                  <div
                    className="w-3 h-3 rounded-full cursor-pointer transition-transform hover:scale-125"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
                  />
                </TooltipTrigger>
                <TooltipContent side={rtl ? 'right' : 'left'} className="bg-xcollab-surface-2 text-white border-xcollab-border">
                  {TEAM_NAMES[i]}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-[#8888A0] mt-3 font-medium"
              >
                EDGE Group
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse Button */}
        <div className="shrink-0 p-2 border-t border-xcollab-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="w-full justify-center text-[#8888A0] hover:text-white hover:bg-white/5"
            aria-label={sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {sidebarCollapsed ? (
              rtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
