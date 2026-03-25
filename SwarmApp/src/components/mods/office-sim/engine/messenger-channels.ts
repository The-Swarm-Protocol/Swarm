/** Messenger Channel Types — External messaging integration patterns
 *
 * Adapted from Claw-Empire's server/messenger/ modules.
 * Defines channel types, session routing, and token handling
 * for bridging agent communications with external platforms.
 */

/* ═══════════════════════════════════════
   Channel Definitions
   ═══════════════════════════════════════ */

export const MESSENGER_CHANNELS = [
  "telegram",
  "whatsapp",
  "discord",
  "googlechat",
  "slack",
  "signal",
  "imessage",
] as const;

export type MessengerChannel = (typeof MESSENGER_CHANNELS)[number];

export function isMessengerChannel(value: unknown): value is MessengerChannel {
  return typeof value === "string" && (MESSENGER_CHANNELS as readonly string[]).includes(value);
}

/* ═══════════════════════════════════════
   Message Types
   ═══════════════════════════════════════ */

export type SenderType = "ceo" | "agent" | "system";
export type ReceiverType = "agent" | "department" | "all";
export type MessageType =
  | "chat"
  | "task_assign"
  | "announcement"
  | "directive"
  | "report"
  | "status_update";

export interface ChannelMessage {
  id: string;
  senderType: SenderType;
  senderId: string | null;
  senderName: string | null;
  senderAvatar: string | null;
  receiverType: ReceiverType;
  receiverId: string | null;
  content: string;
  messageType: MessageType;
  taskId: string | null;
  projectId: string | null;
  createdAt: number;
}

/* ═══════════════════════════════════════
   Session Config
   ═══════════════════════════════════════ */

export interface MessengerSessionConfig {
  id: string;
  name: string;
  /** Target chat/channel/group ID on the external platform */
  targetId: string;
  enabled: boolean;
  /** Bot token for this session (encrypted at rest) */
  token?: string;
  /** Agent ID to route messages to/from */
  agentId?: string;
  /** Workflow pack key for this session */
  workflowPackKey?: string;
}

export interface MessengerChannelConfig {
  /** Primary bot token for this channel */
  token: string;
  /** Per-chat/group sessions */
  sessions: MessengerSessionConfig[];
  /** Whether to actively poll for incoming messages */
  receiveEnabled?: boolean;
}

export type MessengerChannelsConfig = Partial<Record<MessengerChannel, MessengerChannelConfig>>;

/* ═══════════════════════════════════════
   Token Hinting (for multi-bot scenarios)
   ═══════════════════════════════════════ */

/**
 * Build a stable, non-reversible key from channel + token for dedup.
 * In production, use crypto.createHash('sha256'). This is a simplified version.
 */
export function buildTokenHint(channel: MessengerChannel, token: string): string {
  const normalized = token.trim();
  if (!normalized) return "";
  // Simple hash for client-side use; server should use SHA-256
  let h = 0;
  const input = `${channel}:${normalized}`;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).slice(0, 16);
}

/**
 * Build a source identifier with token hint suffix.
 * e.g., "telegram#a1b2c3d4"
 */
export function buildSourceWithHint(channel: MessengerChannel, tokenHint: string): string {
  const normalized = tokenHint.trim().toLowerCase();
  if (!normalized) return channel;
  return `${channel}#${normalized}`;
}

/* ═══════════════════════════════════════
   Session Routing
   ═══════════════════════════════════════ */

export interface SessionRoute {
  channel: MessengerChannel;
  sessionId: string;
  agentId: string | null;
  targetId: string;
  workflowPackKey: string | null;
}

/**
 * Resolve which agent/workflow a message should be routed to
 * based on the channel, source chat ID, and configured sessions.
 */
export function resolveSessionRoute(
  config: MessengerChannelsConfig,
  channel: MessengerChannel,
  sourceChatId: string,
): SessionRoute | null {
  const channelConfig = config[channel];
  if (!channelConfig) return null;

  for (const session of channelConfig.sessions) {
    if (!session.enabled) continue;
    if (session.targetId === sourceChatId) {
      return {
        channel,
        sessionId: session.id,
        agentId: session.agentId ?? null,
        targetId: session.targetId,
        workflowPackKey: session.workflowPackKey ?? null,
      };
    }
  }

  return null;
}

/**
 * Get all sessions that route to a specific agent.
 */
export function getAgentSessions(
  config: MessengerChannelsConfig,
  agentId: string,
): SessionRoute[] {
  const routes: SessionRoute[] = [];

  for (const channel of MESSENGER_CHANNELS) {
    const channelConfig = config[channel];
    if (!channelConfig) continue;

    for (const session of channelConfig.sessions) {
      if (!session.enabled) continue;
      if (session.agentId === agentId) {
        routes.push({
          channel,
          sessionId: session.id,
          agentId,
          targetId: session.targetId,
          workflowPackKey: session.workflowPackKey ?? null,
        });
      }
    }
  }

  return routes;
}

/* ═══════════════════════════════════════
   Receiver Status
   ═══════════════════════════════════════ */

export type ReceiverStatus = "idle" | "polling" | "connected" | "error" | "backoff";

export interface ChannelReceiverStatus {
  channel: MessengerChannel;
  status: ReceiverStatus;
  lastPollAt: number | null;
  lastError: string | null;
  messageCount: number;
}

/* ═══════════════════════════════════════
   Decision Inbox Bridge
   ═══════════════════════════════════════ */

/**
 * Patterns for detecting decision replies in messenger text.
 * Claw-Empire supports: "option 1", "#1", "approve", "resume", etc.
 */
export const DECISION_REPLY_PATTERNS = [
  /^(?:option\s*)?#?(\d+)$/i,
  /^(?:select|choose|pick)\s+#?(\d+)$/i,
  /^(?:approve|ok|yes|go|start)\s*$/i,
  /^(?:resume|restart|retry)\s*$/i,
  /^(?:skip|pass|next)\s*$/i,
] as const;

/**
 * Try to parse a messenger text as a decision reply.
 * Returns the option number if matched, null otherwise.
 */
export function parseDecisionReply(text: string): {
  optionNumber: number | null;
  action: "approve" | "resume" | "skip" | "select" | null;
} {
  const trimmed = text.trim();

  // Numbered selection
  const numMatch = trimmed.match(/^(?:option\s*)?#?(\d+)$/i)
    ?? trimmed.match(/^(?:select|choose|pick)\s+#?(\d+)$/i);
  if (numMatch) {
    return { optionNumber: parseInt(numMatch[1], 10), action: "select" };
  }

  // Approve
  if (/^(?:approve|ok|yes|go|start)\s*$/i.test(trimmed)) {
    return { optionNumber: null, action: "approve" };
  }

  // Resume
  if (/^(?:resume|restart|retry)\s*$/i.test(trimmed)) {
    return { optionNumber: null, action: "resume" };
  }

  // Skip
  if (/^(?:skip|pass|next)\s*$/i.test(trimmed)) {
    return { optionNumber: null, action: "skip" };
  }

  return { optionNumber: null, action: null };
}
