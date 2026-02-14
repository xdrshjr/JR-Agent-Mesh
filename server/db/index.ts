import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;

export function initDatabase(dbPath: string) {
  // Ensure the data directory exists
  try {
    mkdirSync(dirname(dbPath), { recursive: true });
  } catch (err) {
    throw new Error(`Failed to create data directory ${dirname(dbPath)}: ${err}`);
  }

  logger.info('DB', `Opening SQLite database at ${dbPath}`);

  try {
    sqlite = new Database(dbPath);
  } catch (err) {
    throw new Error(`Failed to open SQLite database at ${dbPath}: ${err}`);
  }

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });

  // Create tables if they don't exist
  createTables(sqlite);

  // Run schema migrations for existing databases
  migrateSchema(sqlite);

  // Seed default settings
  seedDefaults(sqlite);

  logger.info('DB', 'Database initialized successfully');

  return db;
}

function createTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      model_provider TEXT,
      model_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      thinking TEXT,
      tool_calls TEXT,
      content_blocks TEXT,
      attachments TEXT,
      token_usage TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

    CREATE TABLE IF NOT EXISTS agent_processes (
      id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      work_dir TEXT,
      pid INTEGER,
      exit_code INTEGER,
      created_at INTEGER NOT NULL,
      stopped_at INTEGER,
      config TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_agent_status ON agent_processes(status);

    CREATE TABLE IF NOT EXISTS agent_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT,
      tool TEXT,
      args TEXT,
      success INTEGER,
      duration INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agent_processes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_agent_outputs_agent ON agent_outputs(agent_id);

    CREATE TABLE IF NOT EXISTS credentials (
      key TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      provider TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_transfers (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      agent_id TEXT,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_file_conversation ON file_transfers(conversation_id);

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL,
      git_url TEXT,
      git_dir TEXT,
      file_path TEXT NOT NULL,
      conversation_id TEXT,
      user_id TEXT NOT NULL DEFAULT 'default',
      is_global INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_skills_user ON skills(user_id);
    CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source);

    CREATE TABLE IF NOT EXISTS skill_activations (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'default',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_skill_activations_conversation ON skill_activations(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_skill_activations_skill ON skill_activations(skill_id);
  `);
}

function migrateSchema(sqlite: Database.Database) {
  // Add content_blocks column to messages table if it doesn't exist
  const columns = sqlite.pragma('table_info(messages)') as Array<{ name: string }>;
  const hasContentBlocks = columns.some((c) => c.name === 'content_blocks');
  if (!hasContentBlocks) {
    sqlite.exec('ALTER TABLE messages ADD COLUMN content_blocks TEXT');
    logger.info('DB', 'Added content_blocks column to messages table');
  }
}

function seedDefaults(sqlite: Database.Database) {
  const now = Date.now();

  // Seed default settings
  const defaults: Record<string, string> = {
    'self_agent.provider': 'anthropic',
    'self_agent.model': 'claude-sonnet-4-5-20250929',
    'self_agent.system_prompt': '',
    'self_agent.custom_url': '',
    'self_agent.custom_model': '',
    'notification.sound': 'true',
    'notification.browser': 'false',
    'agent.max_processes': '10',
    'agent.default_work_dir': './data/workspaces',
    'dispatch.enabled': 'false',
  };

  const settingsStmt = sqlite.prepare(
    'INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)'
  );
  for (const [key, value] of Object.entries(defaults)) {
    settingsStmt.run(key, value, now);
  }

  // Seed predefined credential types (empty values — user fills in later)
  const credentialTypes: Array<{ key: string; displayName: string; provider: string }> = [
    { key: 'anthropic_key', displayName: 'Anthropic API Key', provider: 'anthropic' },
    { key: 'openai_key', displayName: 'OpenAI API Key', provider: 'openai' },
    { key: 'google_key', displayName: 'Google AI API Key', provider: 'google' },
    { key: 'xai_key', displayName: 'xAI API Key', provider: 'xai' },
    { key: 'groq_key', displayName: 'Groq API Key', provider: 'groq' },
    { key: 'mistral_key', displayName: 'Mistral API Key', provider: 'mistral' },
  ];

  const credStmt = sqlite.prepare(
    'INSERT OR IGNORE INTO credentials (key, display_name, encrypted_value, iv, auth_tag, provider, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const cred of credentialTypes) {
    // Insert with empty encrypted_value — placeholder until user sets a real key
    credStmt.run(cred.key, cred.displayName, '', '', '', cred.provider, now);
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function getSqlite(): Database.Database {
  if (!sqlite) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return sqlite;
}

export function closeDatabase() {
  if (sqlite) {
    sqlite.close();
    logger.info('DB', 'Database connection closed');
  }
}
