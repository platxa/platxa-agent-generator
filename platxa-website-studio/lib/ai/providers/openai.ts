/**
 * OpenAI Provider Adapter
 *
 * Adapter for OpenAI models (GPT-4o, GPT-4 Turbo, o1) and DALL-E image generation.
 */

import type {
  ProviderAdapter,
  ImageProviderAdapter,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
  Message,
  ContentBlock,
  Tool,
  ProviderErrorCode,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from "./types";
import { ProviderError } from "./types";

// =============================================================================
// Types
// =============================================================================

/** OpenAI message format */
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIContentPart[] | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

/** OpenAI content part */
interface OpenAIContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

/** OpenAI tool call */
interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** OpenAI tool format */
interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** OpenAI API response */
interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** OpenAI streaming chunk */
interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** OpenAI image generation response */
interface OpenAIImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

/** Adapter configuration options */
export interface OpenAIAdapterOptions {
  /** Function that returns the API key (for secure retrieval) */
  getApiKey?: () => string | undefined;
  /** Base URL for the API */
  baseUrl?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Organization ID */
  organization?: string;
}

// =============================================================================
// OpenAI Adapter
// =============================================================================

/**
 * OpenAI provider adapter for GPT models.
 *
 * @example
 * ```typescript
 * const openai = new OpenAIAdapter({
 *   getApiKey: () => process.env.OPENAI_API_KEY,
 * });
 *
 * const response = await openai.complete({
 *   model: "gpt-4o",
 *   messages: [{ role: "user", content: "Hello!" }],
 *   maxTokens: 1024,
 * });
 * ```
 */
export class OpenAIAdapter implements ProviderAdapter, ImageProviderAdapter {
  readonly name = "openai";
  private getApiKey: () => string | undefined;
  private baseUrl: string;
  private defaultModel: string;
  private organization?: string;

  constructor(options: OpenAIAdapterOptions = {}) {
    this.getApiKey = options.getApiKey || (() => process.env.OPENAI_API_KEY);
    this.baseUrl = options.baseUrl || "https://api.openai.com";
    this.defaultModel = options.defaultModel || "gpt-4o";
    this.organization = options.organization;
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
        "OpenAI API key not configured",
        "invalid_api_key",
        this.name
      );
    }

    const body = this.formatRequest(options);
    const headers = this.buildHeaders(apiKey, options.headers);

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    const data: OpenAIResponse = await response.json();
    return this.parseResponse(data);
  }

  async *stream(options: ProviderRequestOptions): AsyncIterable<StreamChunk> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ProviderError(
        "OpenAI API key not configured",
        "invalid_api_key",
        this.name
      );
    }

    const body = this.formatRequest({ ...options, stream: true });
    const headers = this.buildHeaders(apiKey, options.headers);

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
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
    let contentIndex = 0;

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
            if (data === "[DONE]") {
              yield { type: "message_stop" };
              continue;
            }

            try {
              const chunk: OpenAIStreamChunk = JSON.parse(data);
              const parsed = this.parseStreamChunk(chunk, contentIndex);
              if (parsed) {
                yield parsed;
                if (parsed.delta?.text) contentIndex++;
              }
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

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ProviderError(
        "OpenAI API key not configured",
        "invalid_api_key",
        this.name
      );
    }

    const body: Record<string, unknown> = {
      model: request.model || "dall-e-3",
      prompt: request.prompt,
      n: request.n || 1,
      size: request.size || "1024x1024",
      quality: request.quality || "standard",
      response_format: request.responseFormat || "url",
    };

    if (request.style) {
      body.style = request.style;
    }

    const headers = this.buildHeaders(apiKey);

    const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    const data: OpenAIImageResponse = await response.json();

    return {
      images: data.data.map((img) => ({
        url: img.url,
        b64Json: img.b64_json,
        revisedPrompt: img.revised_prompt,
      })),
      model: request.model || "dall-e-3",
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private buildHeaders(apiKey: string, custom?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...custom,
    };

    if (this.organization) {
      headers["OpenAI-Organization"] = this.organization;
    }

    return headers;
  }

  private formatRequest(options: ProviderRequestOptions): Record<string, unknown> {
    const messages = this.formatMessages(options.messages, options.system);
    const tools = options.tools ? this.formatTools(options.tools) : undefined;

    const body: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      messages,
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      body.top_p = options.topP;
    }

    if (options.stopSequences) {
      body.stop = options.stopSequences;
    }

    if (tools) {
      body.tools = tools;
    }

    if (options.toolChoice) {
      if (options.toolChoice === "auto") {
        body.tool_choice = "auto";
      } else if (options.toolChoice === "any") {
        body.tool_choice = "required";
      } else if (options.toolChoice === "none") {
        body.tool_choice = "none";
      } else if (typeof options.toolChoice === "object") {
        body.tool_choice = {
          type: "function",
          function: { name: options.toolChoice.name },
        };
      }
    }

    if (options.stream) {
      body.stream = true;
      body.stream_options = { include_usage: true };
    }

    return body;
  }

  private formatMessages(messages: Message[], system?: string): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    // Add system message if provided
    if (system) {
      result.push({ role: "system", content: system });
    }

    for (const msg of messages) {
      if (msg.role === "system") {
        result.push({ role: "system", content: this.getTextContent(msg.content) });
        continue;
      }

      if (msg.role === "tool") {
        result.push({
          role: "tool",
          content: this.getTextContent(msg.content),
          tool_call_id: msg.name || "",
        });
        continue;
      }

      const role = msg.role === "assistant" ? "assistant" : "user";
      const content = this.formatContent(msg.content);

      if (role === "assistant" && this.hasToolUse(msg.content)) {
        const toolCalls = this.extractToolCalls(msg.content);
        result.push({
          role: "assistant",
          content: this.getTextContent(msg.content),
          tool_calls: toolCalls,
        });
      } else {
        result.push({ role, content });
      }
    }

    return result;
  }

  private formatContent(content: string | ContentBlock[]): string | OpenAIContentPart[] {
    if (typeof content === "string") {
      return content;
    }

    const parts: OpenAIContentPart[] = [];

    for (const block of content) {
      if (block.type === "text") {
        parts.push({ type: "text", text: block.text });
      } else if (block.type === "image") {
        if (block.source.type === "url" && block.source.url) {
          parts.push({
            type: "image_url",
            image_url: { url: block.source.url },
          });
        } else if (block.source.type === "base64" && block.source.data) {
          const mediaType = block.source.mediaType || "image/png";
          parts.push({
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${block.source.data}` },
          });
        }
      }
    }

    return parts.length === 1 && parts[0].type === "text" ? parts[0].text || "" : parts;
  }

  private getTextContent(content: string | ContentBlock[]): string {
    if (typeof content === "string") return content;
    return content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
  }

  private hasToolUse(content: string | ContentBlock[]): boolean {
    if (typeof content === "string") return false;
    return content.some((b) => b.type === "tool_use");
  }

  private extractToolCalls(content: string | ContentBlock[]): OpenAIToolCall[] {
    if (typeof content === "string") return [];
    return content
      .filter((b) => b.type === "tool_use")
      .map((b) => {
        const toolUse = b as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
        return {
          id: toolUse.id,
          type: "function" as const,
          function: {
            name: toolUse.name,
            arguments: JSON.stringify(toolUse.input),
          },
        };
      });
  }

  private formatTools(tools: Tool[]): OpenAITool[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  private parseResponse(data: OpenAIResponse): ProviderResponse {
    const choice = data.choices[0];
    const content: ContentBlock[] = [];

    if (choice.message.content) {
      content.push({ type: "text", text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments || "{}"),
        });
      }
    }

    return {
      id: data.id,
      model: data.model,
      content,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      raw: data,
    };
  }

  private parseStreamChunk(chunk: OpenAIStreamChunk, _index: number): StreamChunk | null {
    const choice = chunk.choices[0];
    if (!choice) return null;

    if (choice.finish_reason) {
      return {
        type: "message_delta",
        finishReason: this.mapFinishReason(choice.finish_reason),
        usage: chunk.usage
          ? {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            }
          : undefined,
      };
    }

    if (choice.delta.content) {
      return {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "text",
          text: choice.delta.content,
        },
      };
    }

    if (choice.delta.tool_calls) {
      const toolCall = choice.delta.tool_calls[0];
      if (toolCall?.function?.arguments) {
        return {
          type: "content_block_delta",
          index: toolCall.index,
          delta: {
            type: "tool_use",
            partialJson: toolCall.function.arguments,
          },
        };
      }
    }

    return null;
  }

  private mapFinishReason(reason: string): ProviderResponse["finishReason"] {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_use";
      case "content_filter":
        return "content_filter";
      default:
        return "stop";
    }
  }

  private async handleError(response: Response): Promise<ProviderError> {
    let message = `OpenAI API error: ${response.status}`;
    let code: ProviderErrorCode = "unknown";
    let raw: unknown;

    try {
      raw = await response.json();
      if (typeof raw === "object" && raw !== null && "error" in raw) {
        const error = raw as { error: { message?: string; type?: string; code?: string } };
        message = error.error.message || message;

        switch (error.error.type) {
          case "invalid_api_key":
            code = "invalid_api_key";
            break;
          case "rate_limit_exceeded":
            code = "rate_limit";
            break;
          case "insufficient_quota":
            code = "quota_exceeded";
            break;
          case "invalid_request_error":
            code = "invalid_request";
            break;
          case "model_not_found":
            code = "model_not_found";
            break;
          case "context_length_exceeded":
            code = "context_length_exceeded";
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

export default OpenAIAdapter;
