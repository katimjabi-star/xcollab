'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutDashboard, FolderTree, Columns3, ArrowRightLeft, Bot, Users, GanttChart, Settings,
  type LucideIcon, Shield, FileText, Zap, AlertTriangle, CheckSquare2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { ViewType, WBPFlat, ProgramDashboardData, TaskWithAssignee } from '@/lib/types';

const VIEW_ITEMS: { view: ViewType; icon: LucideIcon; labelKey: string; group: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', group: 'Views' },
  { view: 'wbp', icon: FolderTree, labelKey: 'nav.wbp', group: 'Views' },
  { view: 'kanban', icon: Columns3, labelKey: 'nav.kanban', group: 'Views' },
  { view: 'dependencies', icon: ArrowRightLeft, labelKey: 'nav.dependencies', group: 'Views' },
  { view: 'ai-chat', icon: Bot, labelKey: 'nav.aiChat', group: 'Views' },
  { view: 'teams', icon: Users, labelKey: 'team.title', group: 'Views' },
  { view: 'timeline', icon: GanttChart, labelKey: 'Timeline', group: 'Views' },
  { view: 'settings', icon: Settings, labelKey: 'nav.settings', group: 'Views' },
];

const AI_ACTIONS = [
  { label: 'Generate standup report', prompt: 'Generate a daily standup summary for all teams', icon: Zap },
  { label: 'Identify blockers', prompt: 'What is blocking our release? Identify all critical blockers.', icon: AlertTriangle },
  { label: 'Risk assessment', prompt: 'Run a comprehensive risk assessment across all WBPs', icon: Shield },
  { label: 'Create new WBP', prompt: 'Help me create a new Work Breakdown Package', icon: FileText },
  { label: 'Task summary', prompt: 'Give me a summary of all tasks by status', icon: CheckSquare2 },
];

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setView, toggleAiChat, locale } = useAppStore();
  const { t } = useTranslation(locale);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [programData, setProgramData] = useState<ProgramDashboardData | null>(null);

  // Load program data for entity search
  useEffect(() => {
    if (commandPaletteOpen && !programData) {
      fetch('/api/program').then((r) => r.json()).then(setProgramData).catch(() => {});
    }
  }, [commandPaletteOpen, programData]);

  // Reset state handled in keyboard shortcut handler

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!commandPaletteOpen) {
          setQuery('');
          setSelectedIdx(0);
        }
        toggleCommandPalette();
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, toggleCommandPalette, setCommandPaletteOpen]);

  // Auto-focus input when open
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (commandPaletteOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandPaletteOpen]);

  // Flatten WBPs for search
  const flatWbps = useMemo(() => {
    if (!programData) return [];
    const result: WBPFlat[] = [];
    const walk = (w: WBPFlat) => { result.push(w); w.children?.forEach(walk); };
    programData.wbps.forEach(walk);
    return result;
  }, [programData]);

  // Build searchable items
  const items = useMemo(() => {
    const q = query.toLowerCase();
    const results: { id: string; type: string; title: string; subtitle: string; icon: LucideIcon; action: () => void; group: string }[] = [];

    // Views
    if (!q) {
      VIEW_ITEMS.forEach((v) => {
        results.push({
          id: `view-${v.view}`,
          type: 'view',
          title: t(v.labelKey as Parameters<typeof t>[0]),
          subtitle: 'Navigate to view',
          icon: v.icon,
          action: () => { setView(v.view); setCommandPaletteOpen(false); },
          group: v.group,
        });
      });
    } else {
      VIEW_ITEMS.filter((v) => t(v.labelKey as Parameters<typeof t>[0]).toLowerCase().includes(q)).forEach((v) => {
        results.push({
          id: `view-${v.view}`, type: 'view', title: t(v.labelKey as Parameters<typeof t>[0]), subtitle: 'Navigate to view', icon: v.icon,
          action: () => { setView(v.view); setCommandPaletteOpen(false); }, group: 'Views',
        });
      });
    }

    // AI Actions
    AI_ACTIONS.filter((a) => !q || a.label.toLowerCase().includes(q)).forEach((a) => {
      results.push({
        id: `ai-${a.label}`, type: 'action', title: a.label, subtitle: a.prompt, icon: a.icon,
        action: () => {
          setView('ai-chat');
          toggleAiChat();
          setCommandPaletteOpen(false);
        },
        group: 'AI Actions',
      });
    });

    // WBPs
    flatWbps.filter((w) => !q || w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)).slice(0, 6).forEach((w) => {
      results.push({
        id: `wbp-${w.id}`, type: 'wbp', title: `${w.code} — ${w.name}`, subtitle: `${w.status} · ${w.progress}%`, icon: FolderTree,
        action: () => { setView('wbp'); setCommandPaletteOpen(false); },
        group: 'Work Packages',
      });
    });

    // Members
    programData?.members.filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)).slice(0, 5).forEach((m) => {
      results.push({
        id: `member-${m.id}`, type: 'member', title: m.name, subtitle: `${m.role} · ${m.team?.name || 'Unassigned'}`, icon: Users,
        action: () => { setView('teams'); setCommandPaletteOpen(false); },
        group: 'Members',
      });
    });

    return results;
  }, [query, flatWbps, programData, t, setView, setCommandPaletteOpen, toggleAiChat]);

  // Group items
  const grouped = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [items]);

  const flatItems = Object.values(grouped).flat();

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && flatItems[selectedIdx]) { flatItems[selectedIdx].action(); }
  }, [flatItems, selectedIdx]);

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={() => setCommandPaletteOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-[600px] z-[101]"
          >
            <div className="bg-xcollab-surface border border-xcollab-border/60 rounded-2xl shadow-2xl overflow-hidden glow-orange">
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 h-14 border-b border-xcollab-border/40">
                <Search className="w-5 h-5 text-[#71717A] shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search WBPs, tasks, members, actions..."
                  className="flex-1 bg-transparent text-sm text-[#E8E8ED] placeholder:text-[#71717A] outline-none"
                />
                <kbd className="text-[10px] text-[#71717A] bg-xcollab-surface-2 rounded-md px-2 py-0.5 border border-xcollab-border/40 font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto py-2">
                {flatItems.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-[#71717A]">
                    <Search className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">No results found</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([group, groupItems]) => {
                    const globalStart = flatItems.findIndex((i) => i.id === groupItems[0]?.id);
                    return (
                      <div key={group}>
                        <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
                          {group}
                        </div>
                        {groupItems.map((item) => {
                          const globalIdx = flatItems.findIndex((i) => i.id === item.id);
                          const Icon = item.icon;
                          const isSelected = globalIdx === selectedIdx;
                          return (
                            <button
                              key={item.id}
                              onClick={item.action}
                              onMouseEnter={() => setSelectedIdx(globalIdx)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${
                                isSelected ? 'bg-white/[0.06] text-[#E8E8ED]' : 'text-[#B0B0C0] hover:bg-white/[0.03]'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-[#FF4713]/15' : 'bg-xcollab-surface-2'
                              }`}>
                                <Icon className={`w-4 h-4 ${isSelected ? 'text-[#FF4713]' : 'text-[#71717A]'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                <p className="text-xs text-[#71717A] truncate">{item.subtitle}</p>
                              </div>
                              {isSelected && (
                                <kbd className="text-[10px] text-[#71717A] bg-xcollab-surface-3 rounded px-1.5 py-0.5 border border-xcollab-border/30 font-mono shrink-0">
                                  Enter
                                </kbd>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-5 py-2.5 border-t border-xcollab-border/40 text-[11px] text-[#71717A]">
                <span className="flex items-center gap-1.5"><kbd className="bg-xcollab-surface-2 rounded px-1.5 py-0.5 border border-xcollab-border/30 font-mono">↑↓</kbd> Navigate</span>
                <span className="flex items-center gap-1.5"><kbd className="bg-xcollab-surface-2 rounded px-1.5 py-0.5 border border-xcollab-border/30 font-mono">↵</kbd> Select</span>
                <span className="flex items-center gap-1.5"><kbd className="bg-xcollab-surface-2 rounded px-1.5 py-0.5 border border-xcollab-border/30 font-mono">esc</kbd> Close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
