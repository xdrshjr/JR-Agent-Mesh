'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastData {
  id: string;
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
}

const icons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
};

const colors = {
  info: 'border-l-[var(--info)] bg-blue-50',
  warning: 'border-l-[var(--warning)] bg-amber-50',
  error: 'border-l-[var(--error)] bg-red-50',
  success: 'border-l-[var(--success)] bg-emerald-50',
};

const iconColors = {
  info: 'text-[var(--info)]',
  warning: 'text-[var(--warning)]',
  error: 'text-[var(--error)]',
  success: 'text-[var(--success)]',
};

let globalAddToast: ((toast: Omit<ToastData, 'id'>) => void) | null = null;

export function showToast(toast: Omit<ToastData, 'id'>) {
  globalAddToast?.(toast);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    return () => {
      globalAddToast = null;
    };
  }, [addToast]);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((toast) => {
        const Icon = icons[toast.level];
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-[var(--radius)] border border-l-4 shadow-[var(--shadow-md)]',
              'animate-in slide-in-from-right-5 fade-in duration-300',
              colors[toast.level],
            )}
          >
            <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', iconColors[toast.level])} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--foreground)]">{toast.title}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
