'use client';

import { ModelSelector } from '@/components/chat/model-selector';
import { ConversationList } from '@/components/chat/conversation-list';
import { MessageArea } from '@/components/chat/message-area';
import { InputArea } from '@/components/chat/input-area';

export default function ChatPage() {
  return (
    <div className="flex h-full">
      {/* Conversation List (collapsible sidebar) */}
      <ConversationList />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Model Selector Bar */}
        <ModelSelector />

        {/* Messages */}
        <MessageArea />

        {/* Input */}
        <InputArea />
      </div>
    </div>
  );
}
