/**
 * Provider Adapter Types
 *
 * Shared type definitions for AI model provider adapters.
 */

// =============================================================================
// Message Types
// =============================================================================

/** Role in a conversation */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/** Content block types */
export type ContentBlockType = "text" | "image" | "tool_use" | "tool_result";

/** Text content block */
export interface TextContent {
  type: "text";
  text: string;
}

/** Image content block */
export interface ImageContent {
  type: "image";
  source: {
    type: "base64" | "url";
    mediaType?: string;
    data?: string;
    url?: string;
  };
}

/** Tool use content block */
export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Tool result content block */
export interface ToolResultContent {
  type: "tool_result";
  toolUseId: string;
  content: string | ContentBlock[];
  isError?: boolean;
}

/** Union of all content block types */
export type ContentBlock = TextContent | ImageContent | ToolUseContent | ToolResultContent;

/** A message in the conversation */
export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
  name?: string;
}

// =============================================================================
// Tool Types
// =============================================================================

/** JSON Schema definition */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

/** Tool definition */
export interface Tool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

// =============================================================================
// Request Types
// =============================================================================

/** Common request options for all providers */
export interface ProviderRequestOptions {
  /** Model identifier */
  model: string;
  /** Messages in the conversation */
  messages: Message[];
  /** System prompt (if not in messages) */
  system?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0-2) */
  temperature?: number;
  /** Top P sampling */
  topP?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Available tools */
  tools?: Tool[];
  /** Tool choice behavior */
  toolChoice?: "auto" | "any" | "none" | { type: "tool"; name: string };
  /** Enable streaming */
  stream?: boolean;
  /** Request timeout in ms */
  timeout?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Provider-specific options */
  providerOptions?: Record<string, unknown>;
}

// =============================================================================
// Response Types
// =============================================================================

/** Token usage information */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Finish reason for completion */
export type FinishReason = "stop" | "length" | "tool_use" | "content_filter" | "error";

/** Provider response */
export interface ProviderResponse {
  /** Response ID */
  id: string;
  /** Model used */
  model: string;
  /** Generated content */
  content: ContentBlock[];
  /** Finish reason */
  finishReason: FinishReason;
  /** Token usage */
  usage: TokenUsage;
  /** Raw response from provider */
  raw?: unknown;
}

/** Streaming chunk */
export interface StreamChunk {
  /** Chunk type */
  type: "content_block_start" | "content_block_delta" | "content_block_stop" | "message_delta" | "message_stop";
  /** Index of content block */
  index?: number;
  /** Delta content */
  delta?: {
    type: string;
    text?: string;
    partialJson?: string;
  };
  /** Usage (on final chunk) */
  usage?: TokenUsage;
  /** Finish reason (on final chunk) */
  finishReason?: FinishReason;
}

// =============================================================================
// Image Generation Types
// =============================================================================

/** Image generation request */
export interface ImageGenerationRequest {
  /** Text prompt */
  prompt: string;
  /** Number of images to generate */
  n?: number;
  /** Image size */
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  /** Image quality */
  quality?: "standard" | "hd";
  /** Image style */
  style?: "vivid" | "natural";
  /** Response format */
  responseFormat?: "url" | "b64_json";
  /** Model to use */
  model?: string;
}

/** Generated image */
export interface GeneratedImage {
  /** Image URL (if responseFormat is "url") */
  url?: string;
  /** Base64 encoded image (if responseFormat is "b64_json") */
  b64Json?: string;
  /** Revised prompt (if available) */
  revisedPrompt?: string;
}

/** Image generation response */
export interface ImageGenerationResponse {
  /** Generated images */
  images: GeneratedImage[];
  /** Model used */
  model: string;
  /** Request ID */
  id?: string;
}

// =============================================================================
// Provider Adapter Interface
// =============================================================================

/** Provider adapter interface */
export interface ProviderAdapter {
  /** Provider name */
  readonly name: string;

  /** Send a completion request */
  complete(options: ProviderRequestOptions): Promise<ProviderResponse>;

  /** Send a streaming completion request */
  stream(options: ProviderRequestOptions): AsyncIterable<StreamChunk>;

  /** Check if the provider is configured and available */
  isAvailable(): boolean;

  /** Get the provider's API key (masked) */
  getApiKeyPreview(): string | null;
}

/** Image generation provider interface */
export interface ImageProviderAdapter {
  /** Provider name */
  readonly name: string;

  /** Generate images */
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;

  /** Check if the provider is configured and available */
  isAvailable(): boolean;
}

// =============================================================================
// Error Types
// =============================================================================

/** Provider error codes */
export type ProviderErrorCode =
  | "invalid_api_key"
  | "rate_limit"
  | "quota_exceeded"
  | "invalid_request"
  | "model_not_found"
  | "context_length_exceeded"
  | "content_filter"
  | "server_error"
  | "timeout"
  | "network_error"
  | "unknown";

/** Provider error */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly raw?: unknown
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
