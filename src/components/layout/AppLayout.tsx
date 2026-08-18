'use client';

import { useEffect, type ReactNode } from 'react';
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
  const { locale, theme, setTheme, accent, setAccent, aiChatOpen, setAiChatOpen, currentView, mobileNavOpen, setMobileNavOpen } =
    useAppStore();
  const rtl = isRTL(locale);

  // Keep the document element in sync so screen readers and browser
  // features (find-in-page, translation) see the right language.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [locale, rtl]);

  // Restore the saved theme/accent once on mount.
  useEffect(() => {
    const savedTheme = localStorage.getItem('xcollab-theme');
    if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') setTheme(savedTheme);
    const savedAccent = localStorage.getItem('xcollab-accent');
    if (savedAccent && /^#[0-9A-Fa-f]{6}$/.test(savedAccent)) setAccent(savedAccent);
  }, [setTheme, setAccent]);

  // Apply theme class + brand accent to the document, and persist choices.
  useEffect(() => {
    const root = document.documentElement;
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : theme;
    root.classList.remove('dark', 'light');
    root.classList.add(resolved);
    root.style.setProperty('--brand', accent);
    localStorage.setItem('xcollab-theme', theme);
    localStorage.setItem('xcollab-accent', accent);
  }, [theme, accent]);

  const showAiPanel = aiChatOpen && currentView !== 'ai-chat';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="min-h-screen flex bg-[var(--bg-0)] text-[var(--ink-1)]">
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
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--ink-1)]/[0.02] to-transparent pointer-events-none z-10" />
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
            className="hidden lg:flex flex-col border-s border-xcollab-border/60 bg-[var(--bg-1)] overflow-hidden shrink-0"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-xcollab-border/60 shrink-0">
              <span className="text-sm font-semibold text-[var(--ink-1)]">AI Assistant</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--ink-1)]/5"
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
