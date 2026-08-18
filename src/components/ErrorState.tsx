'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="empty-state-icon">
        <AlertTriangle className="w-8 h-8 text-[#F59E0B]" />
      </div>
      <p className="text-sm text-[var(--ink-2)] mt-3">{t('common.failedToLoad')}</p>
      {message && <p className="text-xs text-[var(--ink-3)] mt-1 max-w-sm">{message}</p>}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 border-xcollab-border/60 text-[var(--ink-2)] hover:text-[var(--ink-1)]"
        >
          <RotateCw className="w-3.5 h-3.5 me-1.5" />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
