'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Bot, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function NavMenu() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] text-sm transition-colors duration-150',
              isActive
                ? 'bg-[var(--accent)] text-[var(--accent-foreground)] font-medium'
                : 'text-[var(--text-secondary)] hover:bg-white hover:text-[var(--foreground)]',
            )}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
