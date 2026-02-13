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
    <nav className="flex flex-col items-center gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              'relative group flex items-center justify-center w-10 h-10 rounded-[var(--radius)] transition-colors duration-150',
              isActive
                ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                : 'text-[var(--text-secondary)] hover:bg-white hover:text-[var(--foreground)]',
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="absolute left-full ml-2 px-2 py-1 rounded-[var(--radius)] bg-[var(--foreground)] text-[var(--background)] text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
