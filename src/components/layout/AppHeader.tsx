'use client';

import { Search, Bell, Globe, Menu, ChevronDown, User, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useTranslation, isRTL } from '@/lib/i18n';
import type { Locale } from '@/lib/types';

export default function AppHeader() {
  const { locale, setLocale, searchQuery, setSearchQuery, mobileNavOpen, toggleMobileNav } =
    useAppStore();
  const { t } = useTranslation(locale);

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'ar' : 'en');
  };

  return (
    <header className="h-14 border-b border-xcollab-border bg-[#0D0D14]/80 backdrop-blur-md flex items-center px-4 gap-4 shrink-0 z-20">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-[#8888A0] hover:text-white hover:bg-white/5 shrink-0"
        onClick={toggleMobileNav}
        aria-label="Toggle navigation"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Program Name */}
      <div className="flex items-center gap-2 shrink-0">
        <Building2 className="w-4 h-4 text-[#FF4713] hidden sm:block" />
        <h1 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-[320px]">
          BRAIN Network Encryptor
        </h1>
      </div>

      {/* Search — center */}
      <div className="flex-1 flex justify-center max-w-md mx-auto">
        <div className="relative w-full">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0] pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="bg-xcollab-surface-2 border-xcollab-border text-sm text-white placeholder:text-[#8888A0] h-9 ps-9 focus-visible:ring-[#FF4713]/30 focus-visible:border-[#FF4713]/50"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="text-[#8888A0] hover:text-white hover:bg-white/5 text-xs font-bold gap-1 px-2 h-9"
          aria-label={t('common.language')}
        >
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">{locale === 'en' ? 'EN' : 'AR'}</span>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-[#8888A0] hover:text-white hover:bg-white/5 h-9 w-9"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-[#EF4444] rounded-full pulse-dot" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isRTL(locale) ? 'start' : 'end'}
            className="w-72 bg-xcollab-surface border-xcollab-border"
          >
            <DropdownMenuLabel className="text-[#8888A0] text-xs font-semibold">
              Notifications
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-xcollab-border" />
            <DropdownMenuItem className="text-xcollab-text text-sm cursor-pointer focus:bg-xcollab-surface-2">
              <span className="w-2 h-2 rounded-full bg-[#FF4713] me-2 shrink-0" />
              WBP-101 milestone approaching
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xcollab-text text-sm cursor-pointer focus:bg-xcollab-surface-2">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] me-2 shrink-0" />
              Risk flagged on WBP-204
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xcollab-text text-sm cursor-pointer focus:bg-xcollab-surface-2">
              <span className="w-2 h-2 rounded-full bg-[#3B82F6] me-2 shrink-0" />
              Task moved to Review
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Team Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex text-[#8888A0] hover:text-white hover:bg-white/5 text-xs gap-1.5 h-9 px-2"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: '#FF4713' }}
              />
              <span>Cyber Ops</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isRTL(locale) ? 'start' : 'end'}
            className="w-48 bg-xcollab-surface border-xcollab-border"
          >
            <DropdownMenuLabel className="text-[#8888A0] text-xs font-semibold">
              Switch Team
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-xcollab-border" />
            {[
              { name: 'Cyber Ops', color: '#FF4713' },
              { name: 'Engineering', color: '#22C55E' },
              { name: 'Comms', color: '#3B82F6' },
              { name: 'Logistics', color: '#F59E0B' },
            ].map((team) => (
              <DropdownMenuItem
                key={team.name}
                className="text-xcollab-text text-sm cursor-pointer focus:bg-xcollab-surface-2 gap-2"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                {team.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full p-0 hover:ring-2 hover:ring-[#FF4713]/30"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#FF4713]/20 text-[#FF4713] text-xs font-bold">
                  AK
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isRTL(locale) ? 'start' : 'end'}
            className="w-56 bg-xcollab-surface border-xcollab-border"
          >
            <DropdownMenuLabel className="text-white font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">A. Khalid</p>
                <p className="text-xs text-[#8888A0]">a.khalid@edgegroup.dev</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-xcollab-border" />
            <DropdownMenuItem className="text-xcollab-text text-sm cursor-pointer focus:bg-xcollab-surface-2 gap-2">
              <User className="w-4 h-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xcollab-text text-sm cursor-pointer focus:bg-xcollab-surface-2 gap-2">
              <Building2 className="w-4 h-4" />
              EDGE Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
