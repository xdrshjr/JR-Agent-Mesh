export default function ChatPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b border-[var(--border)] flex items-center px-6">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)]">Chat</h2>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center text-[var(--muted-foreground)] mt-32">
            <p className="text-2xl font-light mb-2">JRAgentMesh</p>
            <p className="text-sm">Start a conversation with the AI agent</p>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border)] p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 border border-[var(--border)] rounded-lg px-4 py-3 bg-white focus-within:border-[var(--primary)] transition-colors">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 outline-none text-sm bg-transparent"
              disabled
            />
            <button
              className="px-3 py-1.5 bg-[var(--primary)] text-white text-sm rounded-md opacity-50 cursor-not-allowed"
              disabled
            >
              Send
            </button>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-2 text-center">
            Chat functionality will be implemented in phase 03
          </p>
        </div>
      </div>
    </div>
  );
}
