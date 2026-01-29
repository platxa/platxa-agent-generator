/**
 * Taint Inferencer
 *
 * LLM-based taint specification inference for security analysis.
 * Based on DIVA research for automatic source/sink/propagator detection.
 *
 * Features #13-19: Taint Inference implementation
 *
 * @module taint-inferencer
 */

// =============================================================================
// Types
// =============================================================================

/**
 * CWE (Common Weakness Enumeration) type for security classification
 */
export type CWEType =
  | 'CWE-79'   // Cross-site Scripting (XSS)
  | 'CWE-89'   // SQL Injection
  | 'CWE-78'   // OS Command Injection
  | 'CWE-94'   // Code Injection
  | 'CWE-22'   // Path Traversal
  | 'CWE-611'  // XML External Entity (XXE)
  | 'CWE-502'  // Deserialization
  | 'CWE-918'  // SSRF
  | 'CWE-295'  // Certificate Validation
  | 'CWE-327'  // Broken Crypto
  | 'CWE-798'  // Hardcoded Credentials
  | 'CWE-200'  // Information Exposure
  | 'CWE-Other';

/**
 * Taint classification for an API
 */
export type TaintClassification =
  | 'source'      // Introduces untrusted data (e.g., user input)
  | 'sink'        // Consumes data in security-sensitive way (e.g., SQL query)
  | 'propagator'  // Passes taint through (e.g., string concat)
  | 'sanitizer'   // Removes taint (e.g., escape function)
  | 'safe';       // No taint implications

/**
 * Taint Specification for an API
 *
 * Feature #13: Interface with api, classification, confidence, cweTypes
 */
export interface TaintSpecification {
  /** Fully qualified API name (e.g., "fs.readFile") */
  api: string;
  /** Taint classification */
  classification: TaintClassification;
  /** Confidence score (0-1) */
  confidence: number;
  /** Related CWE types for this API */
  cweTypes: CWEType[];
  /** Which parameters are tainted (for propagators) */
  taintedParams?: number[];
  /** Which return values are tainted */
  taintedReturns?: boolean;
  /** Description of security implications */
  description?: string;
  /** Recommended remediation */
  remediation?: string;
}

/**
 * API Signature for extraction
 *
 * Feature #14: Interface with name, parameters, returnType, module
 */
export interface APISignature {
  /** API/function name */
  name: string;
  /** Parameter types and names */
  parameters: ParameterSignature[];
  /** Return type */
  returnType: string;
  /** Module/namespace the API belongs to */
  module: string;
  /** Whether the API is async */
  isAsync?: boolean;
  /** JSDoc or documentation comment */
  documentation?: string;
}

/**
 * Parameter signature
 */
export interface ParameterSignature {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Whether parameter is optional */
  optional?: boolean;
  /** Default value if any */
  defaultValue?: string;
}

/**
 * Taint Inferencer configuration
 */
export interface TaintInferencerConfig {
  /** Batch size for API classification (20-30 per request recommended) */
  batchSize: number;
  /** Minimum confidence threshold for valid specifications */
  confidenceThreshold: number;
  /** Include CWE context in prompts */
  includeCWEContext: boolean;
  /** Target language for analysis */
  language: 'javascript' | 'typescript' | 'python';
  /** Custom CWE mappings */
  cweMapping?: Map<string, CWEType[]>;
}

/**
 * Batch processing result
 */
export interface BatchProcessResult {
  /** Successfully classified specifications */
  specifications: TaintSpecification[];
  /** APIs that failed classification */
  failed: APISignature[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Number of API calls made */
  apiCallCount: number;
}

/**
 * CodeQL predicate output
 */
export interface CodeQLPredicate {
  /** Predicate name */
  name: string;
  /** Predicate body */
  body: string;
  /** Comment describing the predicate */
  comment: string;
  /** Related CWE types */
  cweTypes: CWEType[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: TaintInferencerConfig = {
  batchSize: 25, // 20-30 recommended by research
  confidenceThreshold: 0.7,
  includeCWEContext: true,
  language: 'javascript',
};

// =============================================================================
// CWE Context Prompts (Feature #19)
// =============================================================================

const CWE_CONTEXT: Record<CWEType, string> = {
  'CWE-79': 'Cross-site Scripting (XSS): Improper neutralization of user input in web output. Look for HTML/JS rendering APIs.',
  'CWE-89': 'SQL Injection: Improper neutralization of special elements in SQL commands. Look for database query APIs.',
  'CWE-78': 'OS Command Injection: Improper neutralization of special elements in OS commands. Look for exec/spawn APIs.',
  'CWE-94': 'Code Injection: Improper control of code generation. Look for eval/Function constructor APIs.',
  'CWE-22': 'Path Traversal: Improper limitation of pathname. Look for file system APIs accepting paths.',
  'CWE-611': 'XML External Entity (XXE): Improper restriction of XML external entities. Look for XML parsing APIs.',
  'CWE-502': 'Deserialization of Untrusted Data: Look for JSON.parse, pickle, or serialization APIs.',
  'CWE-918': 'Server-Side Request Forgery (SSRF): Look for HTTP/URL fetching APIs accepting user URLs.',
  'CWE-295': 'Improper Certificate Validation: Look for TLS/SSL configuration APIs.',
  'CWE-327': 'Use of Broken Crypto Algorithm: Look for cryptographic APIs using weak algorithms.',
  'CWE-798': 'Use of Hard-coded Credentials: Look for authentication/connection APIs.',
  'CWE-200': 'Information Exposure: Look for logging, error handling, or response APIs.',
  'CWE-Other': 'Other security-relevant API with potential taint implications.',
};

// =============================================================================
// Common API Patterns
// =============================================================================

const SOURCE_PATTERNS = [
  /^(req|request)\.(body|query|params|headers|cookies)/i,
  /\.(read|get|fetch|input|prompt)/i,
  /^(process\.env|ENV|getenv)/i,
  /\.(fromUrl|fromFile|fromStream)/i,
  /^(Buffer\.from|atob|decodeURI)/i,
];

const SINK_PATTERNS = [
  /\.(query|exec|execute|run|eval)/i,
  /\.(write|send|render|html|innerHTML)/i,
  /\.(exec|spawn|fork|system)/i,
  /\.(redirect|navigate|open)/i,
  /\.(log|error|warn|info|debug)/i,
];

const SANITIZER_PATTERNS = [
  /\.(escape|encode|sanitize|filter|clean)/i,
  /\.(validate|check|verify)/i,
  /^(encodeURI|encodeURIComponent|escape)/i,
  /\.(htmlEncode|sqlEscape|parameterize)/i,
];

// =============================================================================
// Taint Inferencer Class
// =============================================================================

/**
 * LLM-based Taint Specification Inferencer
 *
 * Feature #15: Class with constructor accepting config
 * Classifies APIs as source/sink/propagator/sanitizer/safe.
 */
export class TaintInferencer {
  private config: TaintInferencerConfig;
  private specCache: Map<string, TaintSpecification>;

  constructor(config: Partial<TaintInferencerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.specCache = new Map();
  }

  /**
   * Infer taint specifications for a list of APIs
   *
   * Feature #16: Classifies APIs as source/sink/propagator/safe.
   *
   * @param apis - API signatures to classify
   * @returns Promise resolving to taint specifications
   */
  async inferSpecs(apis: APISignature[]): Promise<TaintSpecification[]> {
    const specifications: TaintSpecification[] = [];

    for (const api of apis) {
      // Check cache first
      const cacheKey = this.getAPICacheKey(api);
      if (this.specCache.has(cacheKey)) {
        const cached = this.specCache.get(cacheKey);
        if (cached) {
          specifications.push(cached);
          continue;
        }
      }

      // Classify the API
      const spec = this.classifyAPI(api);

      // Only include if above confidence threshold
      if (spec.confidence >= this.config.confidenceThreshold) {
        specifications.push(spec);
        this.specCache.set(cacheKey, spec);
      }
    }

    return specifications;
  }

  /**
   * Process APIs in batches for efficient classification
   *
   * Feature #17: Batch processing (20-30 per request)
   *
   * @param apis - API signatures to process
   * @returns Batch processing result
   */
  async batchProcess(apis: APISignature[]): Promise<BatchProcessResult> {
    const startTime = Date.now();
    const specifications: TaintSpecification[] = [];
    const failed: APISignature[] = [];
    let apiCallCount = 0;

    // Process in batches
    for (let i = 0; i < apis.length; i += this.config.batchSize) {
      const batch = apis.slice(i, i + this.config.batchSize);
      apiCallCount++;

      try {
        const batchSpecs = await this.processBatch(batch);

        for (let j = 0; j < batch.length; j++) {
          const api = batch[j];
          const spec = batchSpecs[j];

          if (api && spec && spec.confidence >= this.config.confidenceThreshold) {
            specifications.push(spec);
          } else if (api) {
            failed.push(api);
          }
        }
      } catch (error) {
        // Add all batch items to failed
        failed.push(...batch);
      }
    }

    return {
      specifications,
      failed,
      processingTimeMs: Date.now() - startTime,
      apiCallCount,
    };
  }

  /**
   * Generate CodeQL predicate from taint specification
   *
   * Feature #18: Outputs CodeQL predicates from specs.
   *
   * @param spec - Taint specification
   * @returns CodeQL predicate string
   */
  generateQLPredicate(spec: TaintSpecification): string {
    const predicateName = this.toPredicateName(spec.api, spec.classification);
    const cweComment = spec.cweTypes.length > 0
      ? `Related CWEs: ${spec.cweTypes.join(', ')}`
      : 'No specific CWE association';

    switch (spec.classification) {
      case 'source':
        return this.generateSourcePredicate(spec, predicateName, cweComment);
      case 'sink':
        return this.generateSinkPredicate(spec, predicateName, cweComment);
      case 'propagator':
        return this.generatePropagatorPredicate(spec, predicateName, cweComment);
      case 'sanitizer':
        return this.generateSanitizerPredicate(spec, predicateName, cweComment);
      default:
        return `// ${spec.api} classified as ${spec.classification} - no predicate needed`;
    }
  }

  /**
   * Generate multiple CodeQL predicates from specifications
   */
  generateQLPredicates(specs: TaintSpecification[]): CodeQLPredicate[] {
    return specs
      .filter((s) => s.classification !== 'safe')
      .map((spec) => ({
        name: this.toPredicateName(spec.api, spec.classification),
        body: this.generateQLPredicate(spec),
        comment: spec.description ?? `${spec.classification} for ${spec.api}`,
        cweTypes: spec.cweTypes,
      }));
  }

  /**
   * Build CWE-aware prompt for classification
   *
   * Feature #19: CWE-aware prompting for security classification.
   *
   * @param api - API to classify
   * @returns Prompt with CWE context
   */
  buildCWEAwarePrompt(api: APISignature): string {
    const parts: string[] = [];

    parts.push('Classify the following API for taint analysis:');
    parts.push('');
    parts.push(`API: ${api.module}.${api.name}`);
    parts.push(`Parameters: ${api.parameters.map((p) => `${p.name}: ${p.type}`).join(', ')}`);
    parts.push(`Returns: ${api.returnType}`);

    if (api.documentation) {
      parts.push(`Documentation: ${api.documentation}`);
    }

    if (this.config.includeCWEContext) {
      parts.push('');
      parts.push('Consider these security contexts:');

      // Add relevant CWE contexts based on API characteristics
      const relevantCWEs = this.inferRelevantCWEs(api);
      for (const cwe of relevantCWEs) {
        parts.push(`- ${CWE_CONTEXT[cwe]}`);
      }
    }

    parts.push('');
    parts.push('Classify as: source | sink | propagator | sanitizer | safe');
    parts.push('Explain your reasoning and provide confidence (0-1).');

    return parts.join('\n');
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Classify a single API using pattern matching
   */
  private classifyAPI(api: APISignature): TaintSpecification {
    const fullName = `${api.module}.${api.name}`;

    // Check against known patterns
    let classification: TaintClassification = 'safe';
    let confidence = 0.5;
    let cweTypes: CWEType[] = [];

    // Check source patterns
    for (const pattern of SOURCE_PATTERNS) {
      if (pattern.test(fullName) || pattern.test(api.name)) {
        classification = 'source';
        confidence = 0.8;
        cweTypes = this.inferCWEsForSource(api);
        break;
      }
    }

    // Check sink patterns
    if (classification === 'safe') {
      for (const pattern of SINK_PATTERNS) {
        if (pattern.test(fullName) || pattern.test(api.name)) {
          classification = 'sink';
          confidence = 0.8;
          cweTypes = this.inferCWEsForSink(api);
          break;
        }
      }
    }

    // Check sanitizer patterns
    if (classification === 'safe') {
      for (const pattern of SANITIZER_PATTERNS) {
        if (pattern.test(fullName) || pattern.test(api.name)) {
          classification = 'sanitizer';
          confidence = 0.75;
          break;
        }
      }
    }

    // Check for propagators (string manipulation, etc.)
    if (classification === 'safe' && this.isPropagator(api)) {
      classification = 'propagator';
      confidence = 0.7;
    }

    return {
      api: fullName,
      classification,
      confidence,
      cweTypes,
      taintedReturns: classification === 'source' || classification === 'propagator',
      description: this.generateDescription(api, classification),
    };
  }

  /**
   * Process a batch of APIs
   */
  private async processBatch(apis: APISignature[]): Promise<TaintSpecification[]> {
    // In a real implementation, this would call an LLM
    // For now, use pattern-based classification
    return apis.map((api) => this.classifyAPI(api));
  }

  /**
   * Check if API is a propagator
   */
  private isPropagator(api: APISignature): boolean {
    const name = api.name.toLowerCase();
    const propagatorNames = [
      'concat', 'join', 'split', 'replace', 'slice', 'substring',
      'trim', 'toLowerCase', 'toUpperCase', 'map', 'filter', 'reduce',
      'toString', 'valueOf', 'format', 'append', 'prepend',
    ];
    return propagatorNames.some((p) => name.includes(p));
  }

  /**
   * Infer CWEs for source APIs
   */
  private inferCWEsForSource(api: APISignature): CWEType[] {
    const name = `${api.module}.${api.name}`.toLowerCase();
    const cweTypes: CWEType[] = [];

    if (name.includes('body') || name.includes('query') || name.includes('param')) {
      cweTypes.push('CWE-79', 'CWE-89');
    }
    if (name.includes('file') || name.includes('path')) {
      cweTypes.push('CWE-22');
    }
    if (name.includes('url') || name.includes('fetch')) {
      cweTypes.push('CWE-918');
    }
    if (name.includes('env') || name.includes('config')) {
      cweTypes.push('CWE-200');
    }

    return cweTypes.length > 0 ? cweTypes : ['CWE-Other'];
  }

  /**
   * Infer CWEs for sink APIs
   */
  private inferCWEsForSink(api: APISignature): CWEType[] {
    const name = `${api.module}.${api.name}`.toLowerCase();
    const cweTypes: CWEType[] = [];

    if (name.includes('query') || name.includes('sql')) {
      cweTypes.push('CWE-89');
    }
    if (name.includes('html') || name.includes('render') || name.includes('innerhtml')) {
      cweTypes.push('CWE-79');
    }
    if (name.includes('exec') || name.includes('spawn') || name.includes('system')) {
      cweTypes.push('CWE-78');
    }
    if (name.includes('eval') || name.includes('function')) {
      cweTypes.push('CWE-94');
    }
    if (name.includes('write') && (name.includes('file') || name.includes('fs'))) {
      cweTypes.push('CWE-22');
    }
    if (name.includes('redirect') || name.includes('navigate')) {
      cweTypes.push('CWE-918');
    }
    if (name.includes('xml') || name.includes('parse')) {
      cweTypes.push('CWE-611');
    }
    if (name.includes('deserialize') || name.includes('unmarshal')) {
      cweTypes.push('CWE-502');
    }

    return cweTypes.length > 0 ? cweTypes : ['CWE-Other'];
  }

  /**
   * Infer relevant CWEs for an API
   */
  private inferRelevantCWEs(api: APISignature): CWEType[] {
    const sourceTypes = this.inferCWEsForSource(api);
    const sinkTypes = this.inferCWEsForSink(api);
    return [...new Set([...sourceTypes, ...sinkTypes])].filter((t) => t !== 'CWE-Other');
  }

  /**
   * Generate description for classification
   */
  private generateDescription(api: APISignature, classification: TaintClassification): string {
    const fullName = `${api.module}.${api.name}`;

    switch (classification) {
      case 'source':
        return `${fullName} introduces potentially untrusted data that should be validated before use.`;
      case 'sink':
        return `${fullName} consumes data in a security-sensitive context. Ensure input is sanitized.`;
      case 'propagator':
        return `${fullName} passes taint through without modification. Track taint flow through this API.`;
      case 'sanitizer':
        return `${fullName} sanitizes/encodes data, potentially removing taint.`;
      default:
        return `${fullName} has no significant taint implications.`;
    }
  }

  /**
   * Generate cache key for an API
   */
  private getAPICacheKey(api: APISignature): string {
    return `${api.module}.${api.name}:${api.parameters.map((p) => p.type).join(',')}`;
  }

  /**
   * Convert API name to CodeQL predicate name
   */
  private toPredicateName(api: string, classification: TaintClassification): string {
    const safeName = api.replace(/[^a-zA-Z0-9]/g, '_');
    return `is${classification.charAt(0).toUpperCase()}${classification.slice(1)}_${safeName}`;
  }

  /**
   * Generate CodeQL source predicate
   */
  private generateSourcePredicate(
    spec: TaintSpecification,
    name: string,
    comment: string
  ): string {
    return `/**
 * ${spec.description ?? `Source predicate for ${spec.api}`}
 * ${comment}
 * Confidence: ${spec.confidence}
 */
predicate ${name}(DataFlow::Node source) {
  exists(DataFlow::CallNode call |
    call.getCalleeName() = "${spec.api.split('.').pop()}" and
    source = call
  )
}`;
  }

  /**
   * Generate CodeQL sink predicate
   */
  private generateSinkPredicate(
    spec: TaintSpecification,
    name: string,
    comment: string
  ): string {
    return `/**
 * ${spec.description ?? `Sink predicate for ${spec.api}`}
 * ${comment}
 * Confidence: ${spec.confidence}
 */
predicate ${name}(DataFlow::Node sink) {
  exists(DataFlow::CallNode call |
    call.getCalleeName() = "${spec.api.split('.').pop()}" and
    sink = call.getAnArgument()
  )
}`;
  }

  /**
   * Generate CodeQL propagator predicate
   */
  private generatePropagatorPredicate(
    spec: TaintSpecification,
    name: string,
    comment: string
  ): string {
    return `/**
 * ${spec.description ?? `Propagator predicate for ${spec.api}`}
 * ${comment}
 * Confidence: ${spec.confidence}
 */
predicate ${name}(DataFlow::Node input, DataFlow::Node output) {
  exists(DataFlow::CallNode call |
    call.getCalleeName() = "${spec.api.split('.').pop()}" and
    input = call.getAnArgument() and
    output = call
  )
}`;
  }

  /**
   * Generate CodeQL sanitizer predicate
   */
  private generateSanitizerPredicate(
    spec: TaintSpecification,
    name: string,
    comment: string
  ): string {
    return `/**
 * ${spec.description ?? `Sanitizer predicate for ${spec.api}`}
 * ${comment}
 * Confidence: ${spec.confidence}
 */
predicate ${name}(DataFlow::Node sanitizer) {
  exists(DataFlow::CallNode call |
    call.getCalleeName() = "${spec.api.split('.').pop()}" and
    sanitizer = call
  )
}`;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a TaintInferencer instance
 */
export function createTaintInferencer(
  config?: Partial<TaintInferencerConfig>
): TaintInferencer {
  return new TaintInferencer(config);
}

/**
 * Infer taint specifications for APIs (convenience function)
 */
export async function inferTaintSpecs(
  apis: APISignature[],
  config?: Partial<TaintInferencerConfig>
): Promise<TaintSpecification[]> {
  const inferencer = new TaintInferencer(config);
  return inferencer.inferSpecs(apis);
}

/**
 * Generate CodeQL predicates from specifications (convenience function)
 */
export function generateCodeQLPredicates(
  specs: TaintSpecification[],
  config?: Partial<TaintInferencerConfig>
): CodeQLPredicate[] {
  const inferencer = new TaintInferencer(config);
  return inferencer.generateQLPredicates(specs);
}
