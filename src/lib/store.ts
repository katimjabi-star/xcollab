import { create } from 'zustand';
import type { ViewType, Locale } from './types';

export type ThemeMode = 'dark' | 'light' | 'system';

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

  // --- Theme ---
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  accent: string;
  setAccent: (accent: string) => void;

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

  // --- AI prompt handoff (command palette → chat view) ---
  pendingAiPrompt: string | null;
  setPendingAiPrompt: (prompt: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentView: 'create',
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

  // Theme
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
  accent: '#FF4713',
  setAccent: (accent) => set({ accent }),

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

  // AI prompt handoff
  pendingAiPrompt: null,
  setPendingAiPrompt: (prompt) => set({ pendingAiPrompt: prompt }),
}));