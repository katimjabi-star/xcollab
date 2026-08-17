'use client';

import { useEffect, useState } from 'react';
import { Search, Bell, Globe, Menu, ChevronDown, User, Building2, Command, Check, Circle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useTranslation, isRTL } from '@/lib/i18n';

const NOTIF_COLORS: Record<string, string> = { risk: '#EF4444', milestone: '#FF4713', task: '#3B82F6', info: '#71717A', approval: '#F59E0B' };

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AppHeader() {
  const { locale, setLocale, searchQuery, setSearchQuery, mobileNavOpen, toggleMobileNav, programName, toggleCommandPalette, notifications, markNotificationRead, markAllNotificationsRead } = useAppStore();
  const { t } = useTranslation(locale);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleLanguage = () => setLocale(locale === 'en' ? 'ar' : 'en');

  return (
    <header className="h-14 border-b border-xcollab-border/60 bg-[#0D0D14]/80 backdrop-blur-md flex items-center px-5 gap-4 shrink-0 z-20">
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" className="md:hidden text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5 shrink-0 h-11 w-11" onClick={toggleMobileNav} aria-label="Toggle navigation">
        <Menu className="w-5 h-5" />
      </Button>

      {/* Program breadcrumb */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <Building2 className="w-[14px] h-[14px] text-[#71717A] shrink-0" />
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-[#71717A] hidden sm:inline">EDGE Group</span>
          <span className="text-[#71717A] hidden sm:inline">/</span>
          <span className="text-[#E8E8ED] font-semibold truncate max-w-[200px] sm:max-w-[320px]">{programName}</span>
        </div>
      </div>

      {/* Command palette trigger */}
      <div className="flex-1 flex justify-center max-w-sm mx-auto">
        <button
          onClick={toggleCommandPalette}
          className="relative w-full text-start rounded-lg h-9 ps-9 pe-9 bg-xcollab-surface-2 border border-xcollab-border/60 hover:border-xcollab-border text-sm text-[#71717A] transition-colors flex items-center"
        >
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
          <span className="truncate">{t('common.search')}</span>
          <kbd className="absolute end-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border border-xcollab-border/60 bg-xcollab-surface-3 px-1.5 text-[10px] font-medium text-[#71717A]">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Language */}
        <Button variant="ghost" size="sm" onClick={toggleLanguage} className="text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5 text-xs font-bold gap-1.5 px-2.5 h-11" aria-label={t('common.language')}>
          <Globe className="w-4 h-4" /><span className="hidden sm:inline">{locale === 'en' ? 'EN' : 'AR'}</span>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-[#71717A] hover:text-[#E8E8ED] hover:bg-white/5 h-11 w-11" aria-label="Notifications">
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && <span className="absolute top-2 end-2 min-w-[16px] h-4 bg-[#EF4444] rounded-full text-[10px] text-white font-bold flex items-center justify-center px-1">{unreadCount}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL(locale) ? 'start' : 'end'} className="w-80 bg-xcollab-surface border-xcollab-border">
            <DropdownMenuLabel className="flex items-center justify-between text-[#E8E8ED] text-xs font-semibold">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllNotificationsRead} className="text-[#FF4713] hover:text-[#FF6B35] text-[11px] font-medium">Mark all read</button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-xcollab-border" />
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  onClick={() => markNotificationRead(notif.id)}
                  className="text-[#B0B0C0] text-sm cursor-pointer focus:bg-xcollab-surface-2 py-3 flex items-start gap-3"
                >
                  <div className="mt-1 shrink-0">
                    <Circle className={`w-2 h-2 ${notif.read ? 'text-transparent' : ''}`} style={{ color: NOTIF_COLORS[notif.type] || '#71717A', fill: notif.read ? 'transparent' : (NOTIF_COLORS[notif.type] || '#71717A') }} />
                </div>
                  <div className="flex-1 min-w-0">
                    <p className={`truncate ${notif.read ? 'text-[#71717A]' : 'text-[#E8E8ED] font-medium'}`}>{notif.title}</p>
                    <p className="text-xs text-[#71717A] truncate mt-0.5">{notif.description}</p>
                    <p className="text-[10px] text-[#71717A] mt-1">{timeAgo(notif.timestamp)}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:ring-2 hover:ring-[#FF4713]/20 transition-all">
              <Avatar className="h-9 w-9"><AvatarFallback className="bg-[#FF4713]/15 text-[#FF4713] text-xs font-bold">AK</AvatarFallback></Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL(locale) ? 'start' : 'end'} className="w-56 bg-xcollab-surface border-xcollab-border">
            <DropdownMenuLabel className="text-[#E8E8ED] font-normal">
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">A. Khalid</p>
                <p className="text-xs text-[#71717A]">a.khalid@edgegroup.dev</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-xcollab-border" />
            <DropdownMenuItem className="text-[#B0B0C0] text-sm cursor-pointer focus:bg-xcollab-surface-2 gap-2.5"><User className="w-4 h-4" />Profile</DropdownMenuItem>
            <DropdownMenuItem className="text-[#B0B0C0] text-sm cursor-pointer focus:bg-xcollab-surface-2 gap-2.5"><Building2 className="w-4 h-4" />EDGE Group</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
