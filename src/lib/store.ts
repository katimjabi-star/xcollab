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
}));
