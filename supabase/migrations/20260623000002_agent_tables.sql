-- AI Agent: conversation history and content drafts

CREATE TABLE IF NOT EXISTS agent_conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  title         text,
  model         text DEFAULT 'gpt-4o',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content         text,
  tool_calls      jsonb,
  tool_call_id    text,
  tool_name       text,
  tool_result     jsonb,
  model           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_messages_conv_idx ON agent_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS agent_content_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES agent_conversations(id) ON DELETE SET NULL,
  type            text NOT NULL DEFAULT 'other',
  title           text NOT NULL,
  content         text NOT NULL,
  tags            text[],
  status          text DEFAULT 'draft',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
