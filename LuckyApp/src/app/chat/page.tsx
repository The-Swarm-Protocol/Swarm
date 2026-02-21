"use client";

import { useState, useCallback } from "react";
import { ChannelList } from "@/components/chat/channel-list";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import {
  CommandMessage,
  mockChannelMessages,
  mockDMMessages,
  mockChannels,
  mockDirectMessages,
} from "@/lib/mock-data";

export default function ChatPage() {
  const [activeId, setActiveId] = useState("ch-general");
  const [activeType, setActiveType] = useState<"channel" | "dm">("channel");
  const [messages, setMessages] = useState<Record<string, CommandMessage[]>>({
    ...mockChannelMessages,
    ...mockDMMessages,
  });

  const handleSelectChannel = (id: string, type: "channel" | "dm") => {
    setActiveId(id);
    setActiveType(type);
  };

  const handleSend = useCallback(
    (content: string) => {
      const newMsg: CommandMessage = {
        id: `msg-${Date.now()}`,
        senderId: "operator-1",
        senderName: "Julio",
        senderType: "operator",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => ({
        ...prev,
        [activeId]: [...(prev[activeId] || []), newMsg],
      }));
    },
    [activeId]
  );

  const currentMessages = messages[activeId] || [];

  // Get display name for the active channel
  const activeName =
    activeType === "channel"
      ? mockChannels.find((c) => c.id === activeId)?.name || "General"
      : mockDirectMessages.find((d) => d.id === activeId)?.participantName ||
        "Chat";

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Sidebar */}
      <ChannelList
        activeChannelId={activeId}
        onSelectChannel={handleSelectChannel}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        <div className="border-b border-gray-200 px-6 py-3 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">
              {activeType === "channel" ? "#" : ""} {activeName}
            </h2>
            {activeType === "dm" && (
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Direct Message
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <MessageList messages={currentMessages} />

        {/* Input */}
        <MessageInput onSend={handleSend} channelName={activeName} />
      </div>
    </div>
  );
}
