import { create } from 'zustand';
import type { ViewType, Locale } from './types';

// ============================================
// XCollab — Zustand Store
// ============================================

interface AppState {
  // --- Navigation ---
  currentView: ViewType;
  setView: (view: ViewType) => void;

  // --- Selections ---
  selectedWbpId: string | null;
  setSelectedWbpId: (id: string | null) => void;
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string | null) => void;

  // --- Program ---
  programId: string;
  programName: string;
  setProgramData: (id: string, name: string) => void;

  // --- Sidebar ---
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // --- Locale ---
  locale: Locale;
  setLocale: (locale: Locale) => void;

  // --- AI Chat Panel ---
  aiChatOpen: boolean;
  setAiChatOpen: (open: boolean) => void;
  toggleAiChat: () => void;

  // --- Loading States ---
  isProgramLoading: boolean;
  setProgramLoading: (loading: boolean) => void;

  // --- Search ---
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // --- Mobile Nav ---
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;

  // --- Command Palette ---
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  // --- Notifications ---
  notifications: Array<{id:string; title:string; description:string; type:string; read:boolean; timestamp:string}>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentView: 'dashboard',
  setView: (view) => set({ currentView: view }),

  // Selections
  selectedWbpId: null,
  setSelectedWbpId: (id) => set({ selectedWbpId: id }),
  selectedTeamId: null,
  setSelectedTeamId: (id) => set({ selectedTeamId: id }),

  // Program
  programId: 'program-brain-001',
  programName: 'BRAIN Network Encryptor',
  setProgramData: (id, name) => set({ programId: id, programName: name }),

  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // Locale
  locale: 'en',
  setLocale: (locale) => set({ locale }),

  // AI Chat
  aiChatOpen: false,
  setAiChatOpen: (open) => set({ aiChatOpen: open }),
  toggleAiChat: () => set((state) => ({ aiChatOpen: !state.aiChatOpen })),

  // Loading
  isProgramLoading: false,
  setProgramLoading: (loading) => set({ isProgramLoading: loading }),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Mobile Nav
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),

  // Command Palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  // Notifications
  notifications: [
    { id: 'n1', title: 'WBP-210 milestone approaching', description: 'Post-Quantum Crypto Module — 3 weeks to deadline', type: 'milestone', read: false, timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
    { id: 'n2', title: 'Critical risk flagged', description: 'FIPS 140-2 L4 lab availability — 6-month lead time', type: 'risk', read: false, timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
    { id: 'n3', title: 'Task moved to Review', description: 'FIPS 140-2 L4 test vectors → Review', type: 'task', read: false, timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
    { id: 'n4', title: 'New member joined', description: 'Omar Al-Farsi joined Hardware Engineering', type: 'info', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
    { id: 'n5', title: 'WBP-100 approval pending', description: 'Hardware Platform scope review needs your sign-off', type: 'approval', read: false, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
  ],
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
  })),
  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
  })),
}));