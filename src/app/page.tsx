'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import AppLayout from '@/components/layout/AppLayout';
import DashboardView from '@/components/views/DashboardView';
import WBPExplorerView from '@/components/views/WBPExplorerView';
import KanbanView from '@/components/views/KanbanView';
import DependenciesView from '@/components/views/DependenciesView';
import AIChatView from '@/components/views/AIChatView';
import type { ViewType } from '@/lib/types';

const VIEW_COMPONENTS: Record<ViewType, React.ComponentType> = {
  dashboard: DashboardView,
  wbp: WBPExplorerView,
  kanban: KanbanView,
  dependencies: DependenciesView,
  'ai-chat': AIChatView,
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] text-white p-8">
          <div className="max-w-lg">
            <h1 className="text-2xl font-bold text-[#FF4713] mb-4">Something went wrong</h1>
            <pre className="text-sm text-red-400 bg-red-400/10 p-4 rounded-lg overflow-auto max-h-64">{this.state.error?.message}\n\n{this.state.error?.stack}</pre>
            <button onClick={() => this.setState({ hasError: false })} className="mt-4 px-4 py-2 bg-[#FF4713] text-white rounded-lg">Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  const { currentView } = useAppStore();
  const ViewComponent = VIEW_COMPONENTS[currentView];
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
        <div className="text-[#FF4713] text-xl font-bold tracking-wider">XCOLLAB</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
