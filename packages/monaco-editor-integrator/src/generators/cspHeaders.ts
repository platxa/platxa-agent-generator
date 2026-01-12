/**
 * CSP Headers Generator
 *
 * Generates Content Security Policy headers required for Monaco Editor
 * workers and WebAssembly execution.
 */

import type { BuildTool } from '../types/index.js';

/**
 * CSP directive configuration.
 */
export interface CspDirectives {
  /** default-src directive */
  defaultSrc: string[];
  /** script-src directive */
  scriptSrc: string[];
  /** worker-src directive */
  workerSrc: string[];
  /** style-src directive */
  styleSrc: string[];
  /** font-src directive */
  fontSrc: string[];
  /** connect-src directive */
  connectSrc: string[];
  /** img-src directive */
  imgSrc: string[];
}

/**
 * CSP generation options.
 */
export interface CspOptions {
  /** WebSocket server URL for Yjs sync */
  websocketUrl?: string;
  /** Whether to allow inline styles (required for Monaco) */
  allowInlineStyles: boolean;
  /** Whether to use nonce-based CSP */
  useNonce: boolean;
  /** Additional allowed domains */
  additionalDomains?: string[];
}

/**
 * Default CSP directives for Monaco Editor.
 */
const DEFAULT_CSP_DIRECTIVES: CspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
  workerSrc: ["'self'", 'blob:'],
  styleSrc: ["'self'", "'unsafe-inline'"],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  imgSrc: ["'self'", 'data:', 'blob:'],
};

/**
 * Generates CSP directives for Monaco Editor.
 *
 * @param options - CSP generation options
 * @returns CspDirectives object
 */
export function generateCspDirectives(options: CspOptions): CspDirectives {
  const directives: CspDirectives = {
    defaultSrc: [...DEFAULT_CSP_DIRECTIVES.defaultSrc],
    scriptSrc: [...DEFAULT_CSP_DIRECTIVES.scriptSrc],
    workerSrc: [...DEFAULT_CSP_DIRECTIVES.workerSrc],
    styleSrc: [...DEFAULT_CSP_DIRECTIVES.styleSrc],
    fontSrc: [...DEFAULT_CSP_DIRECTIVES.fontSrc],
    connectSrc: [...DEFAULT_CSP_DIRECTIVES.connectSrc],
    imgSrc: [...DEFAULT_CSP_DIRECTIVES.imgSrc],
  };

  // Add WebSocket URL for Yjs sync
  if (options.websocketUrl !== undefined) {
    const wsUrl = new URL(options.websocketUrl);
    directives.connectSrc.push(wsUrl.origin);
    // Also add wss:// variant if using ws://
    if (wsUrl.protocol === 'ws:') {
      directives.connectSrc.push(wsUrl.origin.replace('ws:', 'wss:'));
    }
  }

  // Add additional domains
  if (options.additionalDomains !== undefined) {
    for (const domain of options.additionalDomains) {
      directives.connectSrc.push(domain);
    }
  }

  // Handle nonce-based CSP
  if (options.useNonce) {
    // Replace unsafe-inline with nonce placeholder
    directives.styleSrc = directives.styleSrc.filter((s) => s !== "'unsafe-inline'");
    directives.styleSrc.push("'nonce-{{NONCE}}'");
    directives.scriptSrc.push("'nonce-{{NONCE}}'");
  }

  return directives;
}

/**
 * Converts CSP directives to a header string.
 *
 * @param directives - CSP directives object
 * @returns CSP header string
 */
export function directivesToString(directives: CspDirectives): string {
  const parts: string[] = [];

  parts.push(`default-src ${directives.defaultSrc.join(' ')}`);
  parts.push(`script-src ${directives.scriptSrc.join(' ')}`);
  parts.push(`worker-src ${directives.workerSrc.join(' ')}`);
  parts.push(`style-src ${directives.styleSrc.join(' ')}`);
  parts.push(`font-src ${directives.fontSrc.join(' ')}`);
  parts.push(`connect-src ${directives.connectSrc.join(' ')}`);
  parts.push(`img-src ${directives.imgSrc.join(' ')}`);

  return parts.join('; ');
}

/**
 * Generates a complete CSP header value.
 *
 * @param options - CSP generation options
 * @returns CSP header string
 */
export function generateCspHeader(options: CspOptions): string {
  const directives = generateCspDirectives(options);
  return directivesToString(directives);
}

/**
 * Generates Next.js headers configuration for CSP.
 *
 * @param options - CSP generation options
 * @returns Next.js headers config string
 */
export function generateNextjsHeaders(options: CspOptions): string {
  const cspValue = generateCspHeader(options);

  return `// Add to next.config.js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: \`${cspValue}\`,
        },
      ],
    },
  ];
},
`;
}

/**
 * Generates Vite/Express middleware for CSP.
 *
 * @param options - CSP generation options
 * @returns Middleware code string
 */
export function generateCspMiddleware(options: CspOptions): string {
  const cspValue = generateCspHeader(options);

  return `// CSP Middleware
export function cspMiddleware(req, res, next) {
  res.setHeader('Content-Security-Policy', '${cspValue}');
  next();
}
`;
}

/**
 * Generates HTML meta tag for CSP.
 *
 * @param options - CSP generation options
 * @returns HTML meta tag string
 */
export function generateCspMetaTag(options: CspOptions): string {
  const cspValue = generateCspHeader(options);

  return `<meta http-equiv="Content-Security-Policy" content="${cspValue}">`;
}

/**
 * Generates CSP configuration documentation.
 *
 * @returns Documentation string
 */
export function generateCspDocumentation(): string {
  return `# Content Security Policy for Monaco Editor

Monaco Editor requires specific CSP directives to function properly:

## Required Directives

### worker-src
\`\`\`
worker-src 'self' blob:;
\`\`\`
Monaco uses Web Workers for syntax highlighting and language features.
The \`blob:\` source is required for dynamically created workers.

### script-src
\`\`\`
script-src 'self' 'wasm-unsafe-eval';
\`\`\`
The \`wasm-unsafe-eval\` directive allows WebAssembly compilation,
which is used by some Monaco features.

### style-src
\`\`\`
style-src 'self' 'unsafe-inline';
\`\`\`
Monaco dynamically injects styles for theming and syntax highlighting.
Use nonce-based CSP in production for better security.

### connect-src
\`\`\`
connect-src 'self' wss://your-yjs-server.com;
\`\`\`
Add your Yjs WebSocket server URL to allow real-time synchronization.

## Example Complete CSP

\`\`\`
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  connect-src 'self' wss://sync.example.com;
  img-src 'self' data: blob:;
\`\`\`

## Nonce-Based CSP (Recommended for Production)

For better security, use nonce-based CSP instead of 'unsafe-inline':

1. Generate a random nonce on each request
2. Add the nonce to your CSP header
3. Add the nonce to all inline scripts and styles

Example with Next.js:
\`\`\`javascript
// middleware.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export function middleware(request) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const response = NextResponse.next();

  response.headers.set(
    'Content-Security-Policy',
    \`script-src 'self' 'nonce-\${nonce}' 'wasm-unsafe-eval'; ...\`
  );

  return response;
}
\`\`\`
`;
}

/**
 * Determines the appropriate CSP generator based on build tool.
 *
 * @param buildTool - The detected build tool
 * @param options - CSP generation options
 * @returns Generated CSP content and type
 */
export function generateCspForBuildTool(
  buildTool: BuildTool,
  options: CspOptions
): { content: string; type: 'headers' | 'middleware' | 'meta' } {
  switch (buildTool) {
    case 'nextjs':
      return {
        content: generateNextjsHeaders(options),
        type: 'headers',
      };
    case 'vite':
    case 'cra':
    case 'webpack':
      return {
        content: generateCspMiddleware(options),
        type: 'middleware',
      };
    default:
      return {
        content: generateCspMetaTag(options),
        type: 'meta',
      };
  }
}
