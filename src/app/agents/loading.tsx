export default function AgentsLoading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Toolbar */}
      <div className="h-12 border-b border-[var(--border)] flex items-center gap-3 px-4 shrink-0">
        <div className="h-8 w-28 rounded-[var(--radius)] bg-[var(--border)]" />
        <div className="h-7 w-20 rounded-full bg-[var(--border)] opacity-60" />
        <div className="h-7 w-20 rounded-full bg-[var(--border)] opacity-60" />
      </div>

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--border)]" />
          <div className="h-4 w-36 mx-auto rounded bg-[var(--border)]" />
          <div className="h-3 w-48 mx-auto rounded bg-[var(--border)] opacity-60" />
        </div>
      </div>
    </div>
  );
}
