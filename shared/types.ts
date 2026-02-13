// ============================================================
// Shared types for JRAgentMesh — used by both server and client
// ============================================================

// --- Agent Types ---

export type AgentTypeId = 'claude-code' | 'opencode' | 'codex';

export type AgentStatus = 'STARTING' | 'RUNNING' | 'STOPPED' | 'CRASHED' | 'EXITED' | 'FAILED';

export interface AgentInfo {
  id: string;
  name: string;
  typeId: AgentTypeId;
  status: AgentStatus;
  workDir: string;
  createdAt: number;
}

export interface ParsedOutput {
  type: 'text' | 'tool_start' | 'tool_end' | 'thinking' | 'error' | 'raw' | 'user_input';
  content?: string;
  tool?: string;
  args?: string;
  success?: boolean;
  duration?: number;
}

// --- Chat / Conversation Types ---

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ToolCallRecord {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  success: boolean;
  duration: number;
  startedAt: number;
}

export interface Attachment {
  fileId: string;
  filename: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cost?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string | null;
  thinking: string | null;
  toolCalls: ToolCallRecord[] | null;
  attachments: Attachment[] | null;
  tokenUsage: TokenUsage | null;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string | null;
  modelProvider: string | null;
  modelId: string | null;
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
}

// --- WebSocket Message Protocol ---

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  requestId?: string;
  timestamp: number;
}

// Client → Server messages

export interface ChatSendPayload {
  conversationId: string;
  content: string;
  attachments?: Attachment[];
}

export interface ChatAbortPayload {
  conversationId: string;
}

export interface ChatSteerPayload {
  conversationId: string;
  content: string;
}

export interface ChatSwitchModelPayload {
  provider: string;
  model: string;
}

export interface ChatLoadConversationPayload {
  conversationId: string;
}

export interface ChatToggleDispatchPayload {
  enabled: boolean;
}

export interface AgentCreatePayload {
  typeId: AgentTypeId;
  name?: string;
  workDir?: string;
  initialPrompt?: string;
}

export interface AgentSendInputPayload {
  agentId: string;
  text: string;
}

export interface AgentSendRawInputPayload {
  agentId: string;
  data: string;
}

export interface AgentResizePayload {
  agentId: string;
  cols: number;
  rows: number;
}

export interface AgentStopPayload {
  agentId: string;
}

export interface AgentRestartPayload {
  agentId: string;
}

export interface AgentDeletePayload {
  agentId: string;
}

export interface AgentGetOutputPayload {
  agentId: string;
  fromIndex?: number;
}

export interface FileUploadedPayload {
  fileId: string;
  filename: string;
  size: number;
  conversationId: string;
}

// Server → Client messages

export interface InitPayload {
  selfAgentStatus: 'ready' | 'initializing';
  activeAgents: AgentInfo[];
  currentConversationId: string | null;
}

export interface ChatStreamDeltaPayload {
  conversationId: string;
  messageId: string;
  delta: string;
}

export interface ChatThinkingDeltaPayload {
  conversationId: string;
  messageId: string;
  delta: string;
}

export interface ChatToolStartPayload {
  conversationId: string;
  messageId: string;
  toolCallId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface ChatToolEndPayload {
  conversationId: string;
  messageId: string;
  toolCallId: string;
  tool: string;
  success: boolean;
  result?: string;
  duration: number;
}

export interface ChatMessageCompletePayload {
  conversationId: string;
  messageId: string;
  usage?: TokenUsage;
}

export interface ChatFileReadyPayload {
  conversationId: string;
  messageId: string;
  fileId: string;
  filename: string;
  size: number;
  downloadUrl: string;
}

export interface ChatErrorPayload {
  conversationId: string;
  error: string;
  code?: 'llm_error' | 'tool_error' | 'rate_limit';
}

export interface AgentCreatedPayload {
  id: string;
  name: string;
  typeId: AgentTypeId;
  status: 'RUNNING';
  workDir: string;
  createdAt: number;
}

export interface AgentOutputPayload {
  agentId: string;
  data: ParsedOutput;
  index: number;
}

export interface AgentStatusPayload {
  agentId: string;
  status: AgentStatus;
  reason?: string;
  exitCode?: number;
}

export interface AgentOutputHistoryPayload {
  agentId: string;
  outputs: ParsedOutput[];
  totalCount: number;
}

export interface SystemNotificationPayload {
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  sound?: boolean;
}

// --- All message type string literals ---

export type ClientMessageType =
  | 'ping'
  | 'chat.send'
  | 'chat.abort'
  | 'chat.steer'
  | 'chat.switch_model'
  | 'chat.new_conversation'
  | 'chat.load_conversation'
  | 'chat.toggle_dispatch'
  | 'agent.create'
  | 'agent.send_input'
  | 'agent.send_raw_input'
  | 'agent.resize'
  | 'agent.stop'
  | 'agent.restart'
  | 'agent.delete'
  | 'agent.get_output'
  | 'file.uploaded';

export interface ChatNewConversationCreatedPayload {
  conversationId: string;
}

export interface ChatConversationLoadedPayload {
  conversationId: string;
  messages: Message[];
}

export type ServerMessageType =
  | 'pong'
  | 'init'
  | 'chat.stream_delta'
  | 'chat.thinking_delta'
  | 'chat.tool_start'
  | 'chat.tool_end'
  | 'chat.message_complete'
  | 'chat.file_ready'
  | 'chat.error'
  | 'chat.new_conversation_created'
  | 'chat.conversation_loaded'
  | 'agent.created'
  | 'agent.output'
  | 'agent.status'
  | 'agent.output_history'
  | 'system.notification';
