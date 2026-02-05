/**
 * Anthropic Provider Adapter
 *
 * Adapter for Anthropic's Claude models (Claude 3 Opus, Sonnet, Haiku).
 */

import type {
  ProviderAdapter,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
  Message,
  ContentBlock,
  Tool,
  ProviderErrorCode,
} from "./types";
import { ProviderError } from "./types";

// =============================================================================
// Types
// =============================================================================

/** Anthropic message format */
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

/** Anthropic content block */
interface AnthropicContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

/** Anthropic tool format */
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Anthropic API response */
interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/** Anthropic streaming event */
interface AnthropicStreamEvent {
  type: string;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  message?: AnthropicResponse;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

/** Adapter configuration options */
export interface AnthropicAdapterOptions {
  /** Function that returns the API key (for secure retrieval) */
  getApiKey?: () => string | undefined;
  /** Base URL for the API */
  baseUrl?: string;
  /** Default model to use */
  defaultModel?: string;
}

// =============================================================================
// Anthropic Adapter
// =============================================================================

/**
 * Anthropic provider adapter for Claude models.
 *
 * @example
 * ```typescript
 * const anthropic = new AnthropicAdapter({
 *   getApiKey: () => process.env.ANTHROPIC_API_KEY,
 * });
 *
 * const response = await anthropic.complete({
 *   model: "claude-3-sonnet-20240229",
 *   messages: [{ role: "user", content: "Hello!" }],
 *   maxTokens: 1024,
 * });
 * ```
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly name = "anthropic";
  private getApiKey: () => string | undefined;
  private baseUrl: string;
  private defaultModel: string;

  constructor(options: AnthropicAdapterOptions = {}) {
    this.getApiKey = options.getApiKey || (() => process.env.ANTHROPIC_API_KEY);
    this.baseUrl = options.baseUrl || "https://api.anthropic.com";
    this.defaultModel = options.defaultModel || "claude-3-5-sonnet-20241022";
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  getApiKeyPreview(): string | null {
    const key = this.getApiKey();
    if (!key) return null;
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
  }

  async complete(options: ProviderRequestOptions): Promise<ProviderResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ProviderError(
        "Anthropic API key not configured",
        "invalid_api_key",
        this.name
      );
    }

    const body = this.formatRequest(options);

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...options.headers,
      },
      body: JSON.stringify(body),
      signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    const data: AnthropicResponse = await response.json();
    return this.parseResponse(data);
  }

  async *stream(options: ProviderRequestOptions): AsyncIterable<StreamChunk> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ProviderError(
        "Anthropic API key not configured",
        "invalid_api_key",
        this.name
      );
    }

    const body = this.formatRequest({ ...options, stream: true });

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...options.headers,
      },
      body: JSON.stringify(body),
      signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError("No response body", "server_error", this.name);
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event: AnthropicStreamEvent = JSON.parse(data);
              const chunk = this.parseStreamEvent(event);
              if (chunk) yield chunk;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private formatRequest(options: ProviderRequestOptions): Record<string, unknown> {
    const messages = this.formatMessages(options.messages);
    const tools = options.tools ? this.formatTools(options.tools) : undefined;

    const body: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      messages,
      max_tokens: options.maxTokens || 4096,
    };

    if (options.system) {
      body.system = options.system;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      body.top_p = options.topP;
    }

    if (options.stopSequences) {
      body.stop_sequences = options.stopSequences;
    }

    if (tools) {
      body.tools = tools;
    }

    if (options.toolChoice) {
      if (options.toolChoice === "auto") {
        body.tool_choice = { type: "auto" };
      } else if (options.toolChoice === "any") {
        body.tool_choice = { type: "any" };
      } else if (options.toolChoice === "none") {
        body.tool_choice = { type: "none" };
      } else if (typeof options.toolChoice === "object") {
        body.tool_choice = { type: "tool", name: options.toolChoice.name };
      }
    }

    if (options.stream) {
      body.stream = true;
    }

    return body;
  }

  private formatMessages(messages: Message[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        // System messages are handled separately in Anthropic
        continue;
      }

      const role = msg.role === "assistant" ? "assistant" : "user";
      const content = this.formatContent(msg.content);

      result.push({ role, content });
    }

    return result;
  }

  private formatContent(content: string | ContentBlock[]): string | AnthropicContentBlock[] {
    if (typeof content === "string") {
      return content;
    }

    return content.map((block): AnthropicContentBlock => {
      switch (block.type) {
        case "text":
          return { type: "text", text: block.text };

        case "image":
          if (block.source.type === "base64") {
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: block.source.mediaType || "image/png",
                data: block.source.data || "",
              },
            };
          }
          throw new ProviderError(
            "Anthropic only supports base64 images",
            "invalid_request",
            this.name
          );

        case "tool_use":
          return {
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: block.input,
          };

        case "tool_result":
          return {
            type: "tool_result",
            tool_use_id: block.toolUseId,
            content: typeof block.content === "string" ? block.content : JSON.stringify(block.content),
            is_error: block.isError,
          };

        default:
          throw new ProviderError(
            `Unknown content block type`,
            "invalid_request",
            this.name
          );
      }
    });
  }

  private formatTools(tools: Tool[]): AnthropicTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  private parseResponse(data: AnthropicResponse): ProviderResponse {
    const content: ContentBlock[] = data.content.map((block) => {
      if (block.type === "text") {
        return { type: "text", text: block.text || "" };
      }
      if (block.type === "tool_use") {
        return {
          type: "tool_use",
          id: block.id || "",
          name: block.name || "",
          input: block.input || {},
        };
      }
      return { type: "text", text: "" };
    });

    const finishReason = this.mapStopReason(data.stop_reason);

    return {
      id: data.id,
      model: data.model,
      content,
      finishReason,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      raw: data,
    };
  }

  private parseStreamEvent(event: AnthropicStreamEvent): StreamChunk | null {
    switch (event.type) {
      case "content_block_start":
        return {
          type: "content_block_start",
          index: event.index,
          delta: event.content_block?.type === "text"
            ? { type: "text", text: event.content_block.text }
            : undefined,
        };

      case "content_block_delta":
        return {
          type: "content_block_delta",
          index: event.index,
          delta: {
            type: event.delta?.type || "text",
            text: event.delta?.text,
            partialJson: event.delta?.partial_json,
          },
        };

      case "content_block_stop":
        return {
          type: "content_block_stop",
          index: event.index,
        };

      case "message_delta":
        return {
          type: "message_delta",
          finishReason: event.delta?.stop_reason
            ? this.mapStopReason(event.delta.stop_reason as AnthropicResponse["stop_reason"])
            : undefined,
          usage: event.usage
            ? {
                inputTokens: event.usage.input_tokens || 0,
                outputTokens: event.usage.output_tokens || 0,
                totalTokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0),
              }
            : undefined,
        };

      case "message_stop":
        return { type: "message_stop" };

      default:
        return null;
    }
  }

  private mapStopReason(reason: AnthropicResponse["stop_reason"]): ProviderResponse["finishReason"] {
    switch (reason) {
      case "end_turn":
      case "stop_sequence":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool_use";
      default:
        return "stop";
    }
  }

  private async handleError(response: Response): Promise<ProviderError> {
    let message = `Anthropic API error: ${response.status}`;
    let code: ProviderErrorCode = "unknown";
    let raw: unknown;

    try {
      raw = await response.json();
      if (typeof raw === "object" && raw !== null && "error" in raw) {
        const error = raw as { error: { message?: string; type?: string } };
        message = error.error.message || message;

        switch (error.error.type) {
          case "authentication_error":
            code = "invalid_api_key";
            break;
          case "rate_limit_error":
            code = "rate_limit";
            break;
          case "invalid_request_error":
            code = "invalid_request";
            break;
          case "overloaded_error":
            code = "server_error";
            break;
          default:
            code = response.status >= 500 ? "server_error" : "unknown";
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    return new ProviderError(message, code, this.name, response.status, raw);
  }
}

export default AnthropicAdapter;
