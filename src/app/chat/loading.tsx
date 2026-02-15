export default function ChatLoading() {
  return (
    <div className="flex h-full animate-pulse">
      {/* Conversation list sidebar */}
      <div className="w-64 border-r border-[var(--border)] bg-[var(--surface)] p-3 space-y-3 shrink-0">
        <div className="h-8 rounded-[var(--radius)] bg-[var(--border)]" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-[var(--radius)] bg-[var(--border)] opacity-60" />
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Model selector bar */}
        <div className="h-12 border-b border-[var(--border)] flex items-center px-4 shrink-0">
          <div className="h-7 w-48 rounded-[var(--radius)] bg-[var(--border)]" />
        </div>

        {/* Empty message area */}
        <div className="flex-1" />

        {/* Input bar */}
        <div className="border-t border-[var(--border)] p-4">
          <div className="h-20 rounded-[var(--radius)] bg-[var(--border)]" />
        </div>
      </div>
    </div>
  );
}
