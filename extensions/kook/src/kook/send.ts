import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import type { KookSendResult } from "../types.js";
import { resolveKookAccount } from "../accounts.js";
import {
  sendChannelMessage,
  sendDirectMessage,
  createUserChat,
  type KookApiOptions,
} from "./client.js";

export type SendKookMessageParams = {
  cfg: ClawdbotConfig;
  to: string;
  text: string;
  replyToMessageId?: string;
  accountId?: string;
  isDm?: boolean;
};

/**
 * Normalize a target, stripping prefixes like `kook:channel:`, `kook:user:`, etc.
 * Returns the raw ID.
 */
function normalizeTarget(target: string): string {
  return target
    .replace(/^kook:(channel|user|dm|group):/i, "")
    .replace(/^kook:/i, "")
    .trim();
}

/**
 * Send a message to a Kook channel or DM.
 *
 * For channel messages, `to` is the channel ID.
 * For DMs, `to` is prefixed with `user:` or `dm:` or handled by the `isDm` flag.
 */
export async function sendMessageKook(params: SendKookMessageParams): Promise<KookSendResult> {
  const { cfg, to, text, replyToMessageId, accountId, isDm } = params;
  const account = resolveKookAccount({ cfg, accountId });
  if (!account.configured || !account.token) {
    throw new Error(`KOOK account "${account.accountId}" not configured`);
  }

  const apiOpts: KookApiOptions = { token: account.token };
  const targetId = normalizeTarget(to);

  if (!targetId) {
    throw new Error(`Invalid KOOK target: ${to}`);
  }

  // Determine if this is a DM based on prefix or explicit flag
  const isDirectMessage = isDm || to.startsWith("user:") || to.startsWith("kook:user:");

  if (isDirectMessage) {
    // For DMs, we need to create a chat session first (or use an existing chat_code)
    // If the target looks like a chat_code (alphanumeric), use it directly
    // Otherwise, treat it as a user ID and create a session
    const isChatCode = /^[a-f0-9]{24,}$/i.test(targetId);

    const dmParams: {
      content: string;
      type: number;
      target_id?: string;
      chat_code?: string;
      quote?: string;
    } = {
      content: text,
      type: 9, // KMarkdown
      ...(replyToMessageId ? { quote: replyToMessageId } : {}),
    };

    if (isChatCode) {
      dmParams.chat_code = targetId;
    } else {
      dmParams.target_id = targetId;
    }

    const res = await sendDirectMessage(apiOpts, dmParams);
    if (res.code !== 0) {
      throw new Error(`KOOK DM send failed: ${res.message || `code ${res.code}`}`);
    }

    return {
      messageId: res.data.msg_id,
      chatId: targetId,
    };
  }

  // Channel message
  const res = await sendChannelMessage(apiOpts, {
    target_id: targetId,
    content: text,
    type: 9, // KMarkdown
    ...(replyToMessageId ? { quote: replyToMessageId } : {}),
  });

  if (res.code !== 0) {
    throw new Error(`KOOK send failed: ${res.message || `code ${res.code}`}`);
  }

  return {
    messageId: res.data.msg_id,
    chatId: targetId,
  };
}

/** Create a DM session and return the chat_code. */
export async function createKookDmSession(params: {
  cfg: ClawdbotConfig;
  userId: string;
  accountId?: string;
}): Promise<string> {
  const { cfg, userId, accountId } = params;
  const account = resolveKookAccount({ cfg, accountId });
  if (!account.configured || !account.token) {
    throw new Error(`KOOK account "${account.accountId}" not configured`);
  }

  const res = await createUserChat({ token: account.token }, { target_id: userId });
  if (res.code !== 0) {
    throw new Error(`KOOK create DM session failed: ${res.message || `code ${res.code}`}`);
  }

  return res.data.code;
}
