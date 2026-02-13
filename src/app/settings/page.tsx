export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b border-[var(--border)] flex items-center px-6">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)]">Settings</h2>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* LLM Provider Section */}
          <section>
            <h3 className="text-sm font-semibold mb-4">LLM Provider</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg">
                <span className="text-sm">Provider</span>
                <span className="text-sm text-[var(--muted-foreground)]">Anthropic</span>
              </div>
              <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg">
                <span className="text-sm">Model</span>
                <span className="text-sm text-[var(--muted-foreground)]">claude-sonnet-4-5-20250929</span>
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section>
            <h3 className="text-sm font-semibold mb-4">Notifications</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg">
                <span className="text-sm">Sound notifications</span>
                <span className="text-sm text-[var(--muted-foreground)]">Enabled</span>
              </div>
            </div>
          </section>

          <p className="text-xs text-[var(--muted-foreground)] text-center">
            Settings functionality will be implemented in phase 07
          </p>
        </div>
      </div>
    </div>
  );
}
