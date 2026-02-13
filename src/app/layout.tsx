import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JRAgentMesh',
  description: 'AI Agent Management Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-60 border-r border-[var(--border)] bg-[var(--muted)] flex flex-col">
            <div className="p-4 border-b border-[var(--border)]">
              <h1 className="text-lg font-semibold">JRAgentMesh</h1>
            </div>
            <nav className="flex-1 p-2 space-y-1">
              <a
                href="/chat"
                className="block px-3 py-2 rounded-md text-sm hover:bg-[var(--accent)] transition-colors"
              >
                Chat
              </a>
              <a
                href="/agents"
                className="block px-3 py-2 rounded-md text-sm hover:bg-[var(--accent)] transition-colors"
              >
                Agents
              </a>
              <a
                href="/settings"
                className="block px-3 py-2 rounded-md text-sm hover:bg-[var(--accent)] transition-colors"
              >
                Settings
              </a>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
