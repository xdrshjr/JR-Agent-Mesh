export default function SettingsLoading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header bar */}
      <div className="h-12 border-b border-[var(--border)] flex items-center justify-between px-6 shrink-0">
        <div className="h-4 w-16 rounded bg-[var(--border)]" />
        <div className="h-8 w-16 rounded-[var(--radius)] bg-[var(--border)]" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Tab list */}
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-24 rounded-[var(--radius)] bg-[var(--border)] opacity-60" />
            ))}
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 rounded bg-[var(--border)] opacity-60" />
                <div className="h-10 rounded-[var(--radius)] bg-[var(--border)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
