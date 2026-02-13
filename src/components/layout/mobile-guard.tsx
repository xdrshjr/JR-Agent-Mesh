'use client';

import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

export function MobileGuard({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!mounted) return null;

  if (isMobile) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--surface)] p-8">
        <div className="text-center max-w-sm">
          <div className="text-4xl font-semibold text-[var(--foreground)] mb-2">JRAgentMesh</div>
          <Monitor className="w-16 h-16 mx-auto my-8 text-[var(--text-muted)]" />
          <p className="text-base font-medium text-[var(--foreground)] mb-2">
            请使用桌面设备访问
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            JRAgentMesh 暂不支持移动设备。请在电脑上打开此页面。
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
