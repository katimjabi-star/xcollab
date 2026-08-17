'use client';

import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { isRTL } from '@/lib/i18n';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import AIChatView from '@/components/views/AIChatView';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { locale, aiChatOpen, setAiChatOpen, currentView, mobileNavOpen, setMobileNavOpen } =
    useAppStore();
  const rtl = isRTL(locale);

  const showAiPanel = aiChatOpen && currentView !== 'ai-chat';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="min-h-screen flex bg-[#0A0A0F] text-[#E8E8ED]">
      {/* Sidebar — hidden on mobile unless open */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.div
              initial={{ x: rtl ? 256 : -256 }}
              animate={{ x: 0 }}
              exit={{ x: rtl ? 256 : -256 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 z-50 md:hidden"
              style={{ [rtl ? 'right' : 'left']: 0 }}
            >
              <AppSidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-auto relative">
          {/* Subtle top gradient overlay for depth */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none z-10" />
          <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full relative z-0">
            {children}
          </div>
        </main>
      </div>

      {/* AI Chat slide-in panel */}
      <AnimatePresence>
        {showAiPanel && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 420, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="hidden lg:flex flex-col border-s border-xcollab-border/60 bg-[#0D0D14] overflow-hidden shrink-0"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-xcollab-border/60 shrink-0">
              <span className="text-sm font-semibold text-[#E8E8ED]">AI Assistant</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5"
                onClick={() => setAiChatOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIChatView embedded />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
