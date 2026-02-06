import type { ChannelOutboundAdapter } from "openclaw/plugin-sdk";
import { sendMessageKook } from "./kook/send.js";
import { getKookRuntime } from "./runtime.js";

export const kookOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: (text, limit) => getKookRuntime().channel.text.chunkMarkdownText(text, limit),
  chunkerMode: "markdown",
  textChunkLimit: 4000,

  sendText: async ({ cfg, to, text, accountId }) => {
    const isDm = to.startsWith("user:") || to.startsWith("kook:user:");
    const result = await sendMessageKook({ cfg, to, text, accountId, isDm });
    return { channel: "kook", ...result };
  },

  sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) => {
    // Send text first if provided
    if (text?.trim()) {
      const isDm = to.startsWith("user:") || to.startsWith("kook:user:");
      await sendMessageKook({ cfg, to, text, accountId, isDm });
    }

    // For media, send as a link (Kook requires pre-uploaded assets for inline media)
    if (mediaUrl) {
      const fallbackText = mediaUrl;
      const isDm = to.startsWith("user:") || to.startsWith("kook:user:");
      const result = await sendMessageKook({ cfg, to, text: fallbackText, accountId, isDm });
      return { channel: "kook", ...result };
    }

    const isDm = to.startsWith("user:") || to.startsWith("kook:user:");
    const result = await sendMessageKook({ cfg, to, text: text ?? "", accountId, isDm });
    return { channel: "kook", ...result };
  },
};
