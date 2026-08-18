'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Bell, Globe, Menu, User, Building2, Command, ChevronDown, AtSign, BadgeCheck, MessageSquare, UserPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { postJson } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useInbox, useProgram, usePrograms, queryKeys } from '@/hooks/use-app-data';
import { useTranslation, isRTL, formatTimeAgo } from '@/lib/i18n';
import type { InboxNotification } from '@/lib/types';

const TYPE_ICONS: Record<string, typeof AtSign> = {
  mention: AtSign,
  approval: BadgeCheck,
  comment: MessageSquare,
  assignment: UserPlus,
};

export default function AppHeader() {
  const { locale, setLocale, mobileNavOpen, toggleMobileNav, programName, setProgramData, toggleCommandPalette, setView, setSelectedWbpId } = useAppStore();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const { data: inbox } = useInbox();
  const { data: program } = useProgram();
  const { data: programs } = usePrograms();
  const unreadCount = inbox?.unreadCount ?? 0;
  const recent = (inbox?.notifications ?? []).slice(0, 5);

  // The header is always mounted, so it keeps the store's program identity
  // fresh — including right after an Architect run or a program switch.
  useEffect(() => {
    if (program) setProgramData(program.id, program.name);
  }, [program, setProgramData]);

  const toggleLanguage = () => setLocale(locale === 'en' ? 'ar' : 'en');

  const openNotification = (n: InboxNotification) => {
    if (!n.read) {
      void postJson('/api/inbox', { ids: [n.id] }).then(() =>
        queryClient.invalidateQueries({ queryKey: queryKeys.inbox }),
      );
    }
    if (n.entityType === 'wbp' && n.entityId) {
      setSelectedWbpId(n.entityId);
      setView('wbp');
    } else if (n.entityType === 'task') {
      setView('kanban');
    } else {
      setView('inbox');
    }
  };

  const markAllRead = async () => {
    await postJson('/api/inbox', { all: true });
    await queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
  };

  const switchProgram = async (id: string) => {
    if (id === program?.id) return;
    try {
      await postJson('/api/programs', { id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.program }),
        queryClient.invalidateQueries({ queryKey: queryKeys.programs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
        queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory }),
      ]);
      setSelectedWbpId(null);
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  };

  return (
    <header className="h-14 border-b border-xcollab-border/60 bg-[var(--bg-1)]/80 backdrop-blur-md flex items-center px-5 gap-4 shrink-0 z-20">
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" className="md:hidden text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--ink-1)]/5 shrink-0 h-11 w-11" onClick={toggleMobileNav} aria-label={t('header.toggleNav')}>
        <Menu className="w-5 h-5" />
      </Button>

      {/* Program breadcrumb + switcher */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <Building2 className="w-[14px] h-[14px] text-[var(--ink-3)] shrink-0" />
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-[var(--ink-3)] hidden sm:inline">EDGE Group</span>
          <span className="text-[var(--ink-3)] hidden sm:inline">/</span>
          <span className="text-[var(--ink-3)] hidden md:inline">Katim</span>
          <span className="text-[var(--ink-3)] hidden md:inline">/</span>
          {programs && programs.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-[var(--ink-1)] font-semibold transition-colors hover:bg-[var(--ink-1)]/5" aria-label={t('program.switch')}>
                  <span className="truncate max-w-[180px] sm:max-w-[300px]">{programName}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--ink-3)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 bg-xcollab-surface border-xcollab-border">
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">{t('program.switch')}</DropdownMenuLabel>
                {programs.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => switchProgram(p.id)}
                    className="cursor-pointer gap-2.5 text-sm text-[var(--ink-2)] focus:bg-xcollab-surface-2"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${p.status === 'active' ? 'bg-[var(--brand)]' : 'bg-[var(--line-strong)]'}`} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-xcollab-border" />
                <DropdownMenuItem
                  onClick={() => setView('create')}
                  className="cursor-pointer gap-2 text-sm font-medium text-[var(--brand)] focus:bg-xcollab-surface-2"
                >
                  + {t('program.new')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-[var(--ink-1)] font-semibold truncate max-w-[200px] sm:max-w-[320px]">{programName}</span>
          )}
        </div>
      </div>

      {/* Command palette trigger */}
      <div className="flex-1 flex justify-center max-w-sm mx-auto">
        <button
          onClick={toggleCommandPalette}
          className="relative w-full text-start rounded-lg h-9 ps-9 pe-9 bg-xcollab-surface-2 border border-xcollab-border/60 hover:border-xcollab-border text-sm text-[var(--ink-3)] transition-colors flex items-center"
        >
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
          <span className="truncate">{t('common.search')}</span>
          <kbd className="absolute end-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border border-xcollab-border/60 bg-xcollab-surface-3 px-1.5 text-[10px] font-medium text-[var(--ink-3)]">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Language */}
        <Button variant="ghost" size="sm" onClick={toggleLanguage} className="text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--ink-1)]/5 text-xs font-bold gap-1.5 px-2.5 h-11" aria-label={t('common.language')}>
          <Globe className="w-4 h-4" /><span className="hidden sm:inline">{locale === 'en' ? 'EN' : 'AR'}</span>
        </Button>

        {/* Notifications — live inbox */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--ink-1)]/5 h-11 w-11" aria-label={t('header.notifications')}>
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && <span className="absolute top-2 end-2 min-w-[16px] h-4 bg-[var(--brand)] rounded-full text-[10px] text-[var(--brand-fg)] font-bold flex items-center justify-center px-1 tabular-nums">{unreadCount}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL(locale) ? 'start' : 'end'} className="w-80 bg-xcollab-surface border-xcollab-border">
            <DropdownMenuLabel className="flex items-center justify-between text-[var(--ink-1)] text-xs font-semibold">
              <span>{t('header.notifications')}</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[var(--brand)] hover:text-[var(--brand-hover)] text-[11px] font-medium">{t('header.markAllRead')}</button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-xcollab-border" />
            <div className="max-h-[300px] overflow-y-auto">
              {recent.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-[var(--ink-3)]">{t('inbox.empty')}</p>
              ) : (
                recent.map((n) => {
                  const Icon = TYPE_ICONS[n.type] ?? MessageSquare;
                  return (
                    <DropdownMenuItem
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className="text-[var(--ink-2)] text-sm cursor-pointer focus:bg-xcollab-surface-2 py-3 flex items-start gap-3"
                    >
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${n.read ? 'text-[var(--ink-3)]' : 'text-[var(--brand)]'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`truncate ${n.read ? 'text-[var(--ink-3)]' : 'text-[var(--ink-1)] font-medium'}`}>{n.title}</p>
                        <p className="text-xs text-[var(--ink-3)] truncate mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-[var(--ink-3)] mt-1 font-mono tabular-nums">{formatTimeAgo(locale, n.createdAt)}</p>
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
            <DropdownMenuSeparator className="bg-xcollab-border" />
            <DropdownMenuItem
              onClick={() => setView('inbox')}
              className="cursor-pointer justify-center gap-1.5 text-xs font-medium text-[var(--brand)] focus:bg-xcollab-surface-2"
            >
              {t('inbox.title')}
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:ring-2 hover:ring-[var(--brand)]/20 transition-all">
              <Avatar className="h-9 w-9"><AvatarFallback className="bg-[var(--brand)]/15 text-[var(--brand)] text-xs font-bold">GH</AvatarFallback></Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL(locale) ? 'start' : 'end'} className="w-56 bg-xcollab-surface border-xcollab-border">
            <DropdownMenuLabel className="text-[var(--ink-1)] font-normal">
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Grace Hassan</p>
                <p className="text-xs text-[var(--ink-3)]">grace@edgegroup.ae</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-xcollab-border" />
            <DropdownMenuItem className="text-[var(--ink-2)] text-sm cursor-pointer focus:bg-xcollab-surface-2 gap-2.5"><User className="w-4 h-4" />{t('header.profile')}</DropdownMenuItem>
            <DropdownMenuItem className="text-[var(--ink-2)] text-sm cursor-pointer focus:bg-xcollab-surface-2 gap-2.5"><Building2 className="w-4 h-4" />EDGE Group — Katim</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
