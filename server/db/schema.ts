import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// --- Conversations ---

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title'),
  modelProvider: text('model_provider'),
  modelId: text('model_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  isArchived: integer('is_archived').default(0),
});

// --- Messages ---

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content'),
  thinking: text('thinking'),
  toolCalls: text('tool_calls'),     // JSON string
  attachments: text('attachments'),   // JSON string
  tokenUsage: text('token_usage'),    // JSON string
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('idx_messages_conversation').on(table.conversationId),
]);

// --- Agent Processes ---

export const agentProcesses = sqliteTable('agent_processes', {
  id: text('id').primaryKey(),
  typeId: text('type_id').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(), // 'RUNNING' | 'STOPPED' | 'CRASHED' | 'EXITED' | 'FAILED'
  workDir: text('work_dir'),
  pid: integer('pid'),
  exitCode: integer('exit_code'),
  createdAt: integer('created_at').notNull(),
  stoppedAt: integer('stopped_at'),
  config: text('config'), // JSON string
}, (table) => [
  index('idx_agent_status').on(table.status),
]);

// --- Agent Outputs ---

export const agentOutputs = sqliteTable('agent_outputs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agentId: text('agent_id').notNull().references(() => agentProcesses.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'text' | 'tool_start' | 'tool_end' | 'thinking' | 'error' | 'raw' | 'user_input'
  content: text('content'),
  tool: text('tool'),
  args: text('args'),
  success: integer('success'),
  duration: integer('duration'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('idx_agent_outputs_agent').on(table.agentId),
]);

// --- Credentials ---

export const credentials = sqliteTable('credentials', {
  key: text('key').primaryKey(),
  displayName: text('display_name').notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  provider: text('provider'),
  updatedAt: integer('updated_at').notNull(),
});

// --- Settings ---

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// --- File Transfers ---

export const fileTransfers = sqliteTable('file_transfers', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id'),
  agentId: text('agent_id'),
  filename: text('filename').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  direction: text('direction').notNull(), // 'upload' | 'download'
  status: text('status').notNull(),       // 'pending' | 'completed' | 'expired'
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at'),
}, (table) => [
  index('idx_file_conversation').on(table.conversationId),
]);
