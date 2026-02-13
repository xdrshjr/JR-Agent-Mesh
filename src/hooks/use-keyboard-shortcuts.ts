'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+1 → Chat
      if (isCtrl && e.key === '1') {
        e.preventDefault();
        router.push('/chat');
        return;
      }

      // Ctrl+2 → Agents
      if (isCtrl && e.key === '2') {
        e.preventDefault();
        router.push('/agents');
        return;
      }

      // Ctrl+3 → Settings
      if (isCtrl && e.key === '3') {
        e.preventDefault();
        router.push('/settings');
        return;
      }

      // Ctrl+N → New conversation
      if (isCtrl && e.key === 'n') {
        e.preventDefault();
        // Dispatch a custom event that the chat page can listen to
        window.dispatchEvent(new CustomEvent('jram:new-conversation'));
        return;
      }

      // Ctrl+K → Focus search / command palette
      if (isCtrl && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('jram:command-palette'));
        return;
      }

      // Escape → Close modals/panels
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('jram:escape'));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);
}
