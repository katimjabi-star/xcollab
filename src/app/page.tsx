'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import AppLayout from '@/components/layout/AppLayout';
import CommandPalette from '@/components/CommandPalette';
import CreateProgramView from '@/components/views/CreateProgramView';
import DashboardView from '@/components/views/DashboardView';
import InboxView from '@/components/views/InboxView';
import WBPExplorerView from '@/components/views/WBPExplorerView';
import KanbanView from '@/components/views/KanbanView';
import DependenciesView from '@/components/views/DependenciesView';
import AIChatView from '@/components/views/AIChatView';
import TeamsView from '@/components/views/TeamsView';
import TimelineView from '@/components/views/TimelineView';
import SettingsView from '@/components/views/SettingsView';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { ViewType } from '@/lib/types';

const VIEW_COMPONENTS: Record<ViewType, React.ComponentType> = {
  create: CreateProgramView,
  dashboard: DashboardView,
  inbox: InboxView,
  wbp: WBPExplorerView,
  kanban: KanbanView,
  dependencies: DependenciesView,
  'ai-chat': AIChatView,
  teams: TeamsView,
  timeline: TimelineView,
  settings: SettingsView,
};

export default function Home() {
  const { currentView } = useAppStore();
  const ViewComponent = VIEW_COMPONENTS[currentView];

  return (
    <ErrorBoundary>
      <CommandPalette />
      <AppLayout>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <ViewComponent />
          </motion.div>
        </AnimatePresence>
      </AppLayout>
    </ErrorBoundary>
  );
}
