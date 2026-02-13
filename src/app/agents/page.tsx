export default function AgentsPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-6">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)]">Agents</h2>
        <button
          className="px-3 py-1.5 bg-[var(--primary)] text-white text-sm rounded-md opacity-50 cursor-not-allowed"
          disabled
        >
          New Agent
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-[var(--muted-foreground)] mt-32">
            <p className="text-lg font-light mb-2">No agents running</p>
            <p className="text-sm">Agent management will be implemented in phase 04</p>
          </div>
        </div>
      </div>
    </div>
  );
}
