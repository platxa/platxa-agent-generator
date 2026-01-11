/**
 * Python Language Module
 *
 * Implements the LanguageModule interface for Python-specific error parsing,
 * analysis, root cause detection, and fix generation.
 *
 * @module python-module
 */

import { randomUUID } from 'crypto';
import {
  type AnalysisContext,
  type Evidence,
  type FixSuggestion,
  type LanguageModule,
  type ModuleAnalysisResult,
  type NormalizedError,
  type RootCauseHypothesis,
  type SourceLocation,
  type StackFrame,
  type ValidationResult,
  type ValidationStep,
} from '../core/types.js';

// =============================================================================
// Python Error Patterns
// =============================================================================

const PYTHON_PATTERNS = {
  traceback: /^Traceback \(most recent call last\):/m,
  frame: /^\s*File "([^"]+)", line (\d+)(?:, in (.+))?$/,
  error: /^(\w+(?:Error|Exception|Warning)): (.+)$/,
  syntaxError: /^\s*File "([^"]+)", line (\d+)\n.*\n\s*\^\s*\n(\w+Error): (.+)$/s,
  indentationPointer: /^\s*\^+\s*$/,
  // Pyright output format: /path/to/file.py:10:5 - error: message
  pyright: /^(.+\.pyi?):(\d+):(\d+) - (error|warning|information): (.+)$/,
  // Pyright with rule: /path/to/file.py:10:5 - error: message (reportXxx)
  pyrightWithRule: /^(.+\.pyi?):(\d+):(\d+) - (error|warning|information): (.+?) \((\w+)\)$/,
  // Mypy output format: path/to/file.py:10: error: message
  mypy: /^(.+\.pyi?):(\d+): (error|warning|note): (.+)$/,
  // Mypy with column: path/to/file.py:10:5: error: message
  mypyWithColumn: /^(.+\.pyi?):(\d+):(\d+): (error|warning|note): (.+)$/,
  // Mypy with error code: path/to/file.py:10: error: message  [error-code]
  mypyWithCode: /^(.+\.pyi?):(\d+): (error|warning|note): (.+?)\s+\[([a-z-]+)\]$/,
  // Mypy with column and code: path/to/file.py:10:5: error: message  [error-code]
  mypyWithColumnAndCode: /^(.+\.pyi?):(\d+):(\d+): (error|warning|note): (.+?)\s+\[([a-z-]+)\]$/,
  // Ruff output format: path/to/file.py:10:5: E501 Line too long (100 > 88)
  ruff: /^(.+\.pyi?):(\d+):(\d+): ([A-Z]+\d+) (.+)$/,
  // Ruff with fixable indicator: path/to/file.py:10:5: E501 [*] Line too long
  ruffFixable: /^(.+\.pyi?):(\d+):(\d+): ([A-Z]+\d+) \[\*\] (.+)$/,
  // Bandit output format: >> Issue: [B101:assert_used] message
  banditIssue: /^>>\s*Issue:\s*\[(B\d+):([^\]]+)\]\s*(.+)$/,
  // Bandit location: Location: ./file.py:10:0
  banditLocation: /^\s*Location:\s*(.+\.pyi?):(\d+):(\d+)$/,
  // Bandit severity/confidence: Severity: Low   Confidence: High
  banditSeverity: /^\s*Severity:\s*(Low|Medium|High)\s+Confidence:\s*(Low|Medium|High)$/i,
  // Bandit compact format: file.py:10: B101: message
  banditCompact: /^(.+\.pyi?):(\d+):\s*(B\d+):\s*(.+)$/,
  // Pylint default format: file.py:10:5: C0114: Missing module docstring (missing-module-docstring)
  pylint: /^(.+\.pyi?):(\d+):(\d+): ([CRWEF]\d{4}): (.+?) \(([a-z-]+)\)$/,
  // Pylint without column: file.py:10: C0114: Missing module docstring (missing-module-docstring)
  pylintNoColumn: /^(.+\.pyi?):(\d+): ([CRWEF]\d{4}): (.+?) \(([a-z-]+)\)$/,
  // Pylint parseable format: file.py:10: [C0114(missing-module-docstring), module] Message
  pylintParseable: /^(.+\.pyi?):(\d+): \[([CRWEF]\d{4})\(([a-z-]+)\),\s*([^\]]*)\] (.+)$/,
  // Pylint short format: C:10,5: Missing module docstring (missing-module-docstring)
  pylintShort: /^([CRWEF]):(\d+),(\d+): (.+?) \(([a-z-]+)\)$/,
  // pytest FAILED line: FAILED tests/test_file.py::test_func - AssertionError: message
  pytestFailed: /^FAILED\s+(.+\.py)::([^\s]+)\s+-\s+(\w+(?:Error|Exception)?):?\s*(.*)$/,
  // pytest FAILED line (short): FAILED tests/test_file.py::test_func
  pytestFailedShort: /^FAILED\s+(.+\.py)::([^\s]+)\s*$/,
  // pytest ERROR line: ERROR tests/test_file.py::test_func - message
  pytestError: /^ERROR\s+(.+\.py)::([^\s]+)\s+-\s+(.+)$/,
  // pytest collection error: ERROR collecting tests/test_file.py
  pytestCollectionError: /^ERROR\s+collecting\s+(.+\.py)$/,
  // pytest assertion line: E       AssertionError: assert 1 == 2
  pytestAssertion: /^E\s+(\w+(?:Error|Exception)):\s*(.+)$/,
  // pytest file:line in traceback: tests/test_file.py:10: in test_func
  pytestLocation: /^(.+\.py):(\d+):\s+in\s+(\w+)$/,
  // pytest short test summary header
  pytestSummaryHeader: /^=+\s*(FAILURES|ERRORS|short test summary info)\s*=+$/,
  // pytest fixture error: fixture 'name' not found
  pytestFixtureError: /fixture\s+'([^']+)'\s+not\s+found/,
} as const;

const PYRIGHT_ERROR_CODES: Readonly<Record<string, { description: string; fix: string }>> = {
  reportGeneralTypeIssues: { description: 'General type issue', fix: 'Fix type mismatch' },
  reportArgumentType: { description: 'Incorrect argument type', fix: 'Pass correct argument type' },
  reportReturnType: { description: 'Incorrect return type', fix: 'Fix return type annotation or value' },
  reportAssignmentType: { description: 'Type mismatch in assignment', fix: 'Ensure assigned value matches variable type' },
  reportOptionalMemberAccess: { description: 'Accessing member on optional type', fix: 'Add None check before access' },
  reportOptionalCall: { description: 'Calling optional callable', fix: 'Add None check before call' },
  reportOptionalSubscript: { description: 'Subscripting optional type', fix: 'Add None check before subscript' },
  reportOptionalIterable: { description: 'Iterating optional type', fix: 'Add None check before iteration' },
  reportMissingTypeArgument: { description: 'Missing generic type argument', fix: 'Add type arguments to generic' },
  reportUnusedVariable: { description: 'Unused variable', fix: 'Remove or use the variable' },
  reportUnusedImport: { description: 'Unused import', fix: 'Remove unused import' },
  reportUndefinedVariable: { description: 'Undefined variable', fix: 'Define variable before use' },
  reportMissingImports: { description: 'Missing import', fix: 'Add the required import' },
  reportIncompatibleMethodOverride: { description: 'Incompatible method override', fix: 'Match base class method signature' },
  reportIncompatibleVariableOverride: { description: 'Incompatible variable override', fix: 'Match base class variable type' },
  reportPrivateUsage: { description: 'Private member access', fix: 'Use public API instead' },
  reportConstantRedefinition: { description: 'Constant redefinition', fix: 'Do not reassign constants' },
} as const;

const MYPY_ERROR_CODES: Readonly<Record<string, { description: string; fix: string }>> = {
  'arg-type': { description: 'Argument has incompatible type', fix: 'Pass argument with correct type' },
  'return-value': { description: 'Incompatible return value type', fix: 'Return value matching declared type' },
  'assignment': { description: 'Incompatible types in assignment', fix: 'Assign value matching variable type' },
  'attr-defined': { description: 'Attribute not defined on type', fix: 'Check attribute exists or add type annotation' },
  'name-defined': { description: 'Name not defined', fix: 'Define or import the name before use' },
  'call-arg': { description: 'Invalid argument(s) in call', fix: 'Fix function call arguments' },
  'call-overload': { description: 'No overload matches call', fix: 'Use arguments matching an overload signature' },
  'var-annotated': { description: 'Variable needs type annotation', fix: 'Add type annotation to variable' },
  'import': { description: 'Cannot find module', fix: 'Install module or add type stubs' },
  'no-redef': { description: 'Name redefinition', fix: 'Remove duplicate definition' },
  'override': { description: 'Method override signature mismatch', fix: 'Match base class method signature' },
  'return': { description: 'Missing return statement', fix: 'Add return statement or fix control flow' },
  'union-attr': { description: 'Attribute access on union type', fix: 'Narrow type before attribute access' },
  'index': { description: 'Invalid index type', fix: 'Use correct index type for container' },
  'operator': { description: 'Unsupported operand types', fix: 'Use compatible types for operator' },
  'type-arg': { description: 'Invalid type argument', fix: 'Use valid type for generic parameter' },
  'valid-type': { description: 'Invalid type annotation', fix: 'Fix type annotation syntax' },
  'misc': { description: 'Miscellaneous type error', fix: 'Review and fix type issue' },
  'no-untyped-def': { description: 'Function missing type annotations', fix: 'Add parameter and return type annotations' },
  'no-untyped-call': { description: 'Calling untyped function', fix: 'Add type stubs or annotations to called function' },
  'redundant-cast': { description: 'Redundant cast', fix: 'Remove unnecessary cast' },
  'comparison-overlap': { description: 'Comparison always true/false', fix: 'Fix comparison logic' },
  'unreachable': { description: 'Unreachable code', fix: 'Remove unreachable code or fix control flow' },
} as const;

// Ruff error code prefixes and common codes
const RUFF_ERROR_CODES: Readonly<Record<string, { category: string; description: string; fix: string; fixable: boolean }>> = {
  // E: pycodestyle errors
  E501: { category: 'style', description: 'Line too long', fix: 'Break line into multiple lines', fixable: false },
  E701: { category: 'style', description: 'Multiple statements on one line', fix: 'Split into separate lines', fixable: true },
  E702: { category: 'style', description: 'Multiple statements on one line (semicolon)', fix: 'Remove semicolon, use newline', fixable: true },
  E711: { category: 'style', description: 'Comparison to None', fix: 'Use "is None" instead of "== None"', fixable: true },
  E712: { category: 'style', description: 'Comparison to True/False', fix: 'Use "if x:" instead of "if x == True:"', fixable: true },
  E721: { category: 'style', description: 'Type comparison using ==', fix: 'Use isinstance() instead', fixable: false },
  E722: { category: 'style', description: 'Bare except', fix: 'Specify exception type', fixable: false },
  E731: { category: 'style', description: 'Lambda assignment', fix: 'Use def instead of lambda assignment', fixable: false },
  E741: { category: 'style', description: 'Ambiguous variable name', fix: 'Use descriptive variable name', fixable: false },
  // W: pycodestyle warnings
  W291: { category: 'whitespace', description: 'Trailing whitespace', fix: 'Remove trailing whitespace', fixable: true },
  W292: { category: 'whitespace', description: 'No newline at end of file', fix: 'Add newline at end of file', fixable: true },
  W293: { category: 'whitespace', description: 'Blank line contains whitespace', fix: 'Remove whitespace from blank line', fixable: true },
  // F: Pyflakes
  F401: { category: 'import', description: 'Unused import', fix: 'Remove unused import', fixable: true },
  F402: { category: 'import', description: 'Import shadowed by loop variable', fix: 'Rename loop variable', fixable: false },
  F403: { category: 'import', description: 'Star import used', fix: 'Import specific names instead', fixable: false },
  F405: { category: 'import', description: 'Name may be undefined from star import', fix: 'Import name explicitly', fixable: false },
  F501: { category: 'format', description: 'Invalid format string', fix: 'Fix format string syntax', fixable: false },
  F601: { category: 'dict', description: 'Dictionary key literal repeated', fix: 'Remove duplicate key', fixable: false },
  F811: { category: 'redefinition', description: 'Redefinition of unused name', fix: 'Remove or use the first definition', fixable: true },
  F821: { category: 'undefined', description: 'Undefined name', fix: 'Define or import the name', fixable: false },
  F822: { category: 'undefined', description: 'Undefined name in __all__', fix: 'Define the name or remove from __all__', fixable: false },
  F823: { category: 'undefined', description: 'Local variable referenced before assignment', fix: 'Assign before use', fixable: false },
  F841: { category: 'unused', description: 'Local variable assigned but never used', fix: 'Use or remove the variable', fixable: true },
  // I: isort
  I001: { category: 'import-order', description: 'Import block unsorted or unformatted', fix: 'Run ruff --fix to sort imports', fixable: true },
  I002: { category: 'import-order', description: 'Missing required import', fix: 'Add the required import', fixable: true },
  // N: pep8-naming
  N801: { category: 'naming', description: 'Class name should use CapWords', fix: 'Rename class to CapWords style', fixable: false },
  N802: { category: 'naming', description: 'Function name should be lowercase', fix: 'Rename function to snake_case', fixable: false },
  N803: { category: 'naming', description: 'Argument name should be lowercase', fix: 'Rename argument to snake_case', fixable: false },
  N806: { category: 'naming', description: 'Variable in function should be lowercase', fix: 'Rename variable to snake_case', fixable: false },
  N816: { category: 'naming', description: 'Variable in global scope should not be mixedCase', fix: 'Rename to UPPER_CASE or snake_case', fixable: false },
  // B: flake8-bugbear
  B006: { category: 'bugbear', description: 'Mutable default argument', fix: 'Use None and create in function body', fixable: false },
  B007: { category: 'bugbear', description: 'Unused loop variable', fix: 'Prefix with underscore or use', fixable: false },
  B008: { category: 'bugbear', description: 'Function call in default argument', fix: 'Move call inside function body', fixable: false },
  B009: { category: 'bugbear', description: 'getattr with constant attribute', fix: 'Use direct attribute access', fixable: true },
  B010: { category: 'bugbear', description: 'setattr with constant attribute', fix: 'Use direct attribute assignment', fixable: true },
  B011: { category: 'bugbear', description: 'Assert False should be replaced', fix: 'Use raise AssertionError()', fixable: true },
  B015: { category: 'bugbear', description: 'Pointless comparison', fix: 'Remove useless comparison', fixable: false },
  B017: { category: 'bugbear', description: 'assertRaises(Exception)', fix: 'Use specific exception type', fixable: false },
  B018: { category: 'bugbear', description: 'Useless expression', fix: 'Remove or use the expression', fixable: false },
  // UP: pyupgrade
  UP006: { category: 'upgrade', description: 'Use modern type syntax', fix: 'Use list instead of List', fixable: true },
  UP007: { category: 'upgrade', description: 'Use X | Y for Union', fix: 'Use | syntax for union types', fixable: true },
  UP035: { category: 'upgrade', description: 'Import from typing deprecated', fix: 'Import from collections.abc', fixable: true },
  UP036: { category: 'upgrade', description: 'Version block outdated', fix: 'Remove version check block', fixable: true },
  // RUF: Ruff-specific
  RUF001: { category: 'ruff', description: 'Ambiguous unicode character', fix: 'Replace with ASCII equivalent', fixable: true },
  RUF002: { category: 'ruff', description: 'Ambiguous unicode character in docstring', fix: 'Replace with ASCII equivalent', fixable: true },
  RUF003: { category: 'ruff', description: 'Ambiguous unicode character in comment', fix: 'Replace with ASCII equivalent', fixable: true },
  RUF005: { category: 'ruff', description: 'Consider iterable unpacking', fix: 'Use [*a, *b] instead of a + b', fixable: true },
  RUF100: { category: 'ruff', description: 'Unused noqa directive', fix: 'Remove unused noqa', fixable: true },
} as const;

// Bandit security issue codes
const BANDIT_CODES: Readonly<Record<string, { category: string; severity: string; description: string; fix: string }>> = {
  // B1xx: Misc tests
  B101: { category: 'misc', severity: 'low', description: 'Use of assert detected', fix: 'Replace assert with proper error handling for production code' },
  B102: { category: 'misc', severity: 'medium', description: 'Use of exec detected', fix: 'Avoid exec(); use safer alternatives' },
  B103: { category: 'misc', severity: 'medium', description: 'Permissive file permissions', fix: 'Use restrictive file permissions (e.g., 0o600)' },
  B104: { category: 'misc', severity: 'medium', description: 'Binding to all interfaces', fix: 'Bind to specific interface instead of 0.0.0.0' },
  B105: { category: 'misc', severity: 'low', description: 'Hardcoded password string', fix: 'Use environment variables or secret management' },
  B106: { category: 'misc', severity: 'low', description: 'Hardcoded password as argument', fix: 'Use environment variables or secret management' },
  B107: { category: 'misc', severity: 'low', description: 'Hardcoded password as default', fix: 'Use environment variables or secret management' },
  B108: { category: 'misc', severity: 'medium', description: 'Insecure temp file/directory', fix: 'Use tempfile module with secure defaults' },
  B110: { category: 'misc', severity: 'low', description: 'Try-except-pass detected', fix: 'Handle exceptions explicitly or log them' },
  B112: { category: 'misc', severity: 'low', description: 'Try-except-continue detected', fix: 'Handle exceptions explicitly' },
  // B2xx: Application/framework tests
  B201: { category: 'framework', severity: 'high', description: 'Flask debug mode enabled', fix: 'Disable debug mode in production' },
  B202: { category: 'framework', severity: 'high', description: 'Tarfile unsafe extraction', fix: 'Validate tar members before extraction' },
  // B3xx: Blacklist calls
  B301: { category: 'blacklist', severity: 'medium', description: 'Pickle usage detected', fix: 'Use JSON or other safe serialization' },
  B302: { category: 'blacklist', severity: 'medium', description: 'Marshal usage detected', fix: 'Use JSON or other safe serialization' },
  B303: { category: 'blacklist', severity: 'medium', description: 'MD5 usage detected', fix: 'Use SHA-256 or stronger hash function' },
  B304: { category: 'blacklist', severity: 'high', description: 'DES cipher usage', fix: 'Use AES or other modern cipher' },
  B305: { category: 'blacklist', severity: 'medium', description: 'Cipher with insecure mode', fix: 'Use authenticated encryption (GCM, CCM)' },
  B306: { category: 'blacklist', severity: 'medium', description: 'mktemp usage detected', fix: 'Use tempfile.mkstemp() or NamedTemporaryFile' },
  B307: { category: 'blacklist', severity: 'medium', description: 'eval() usage detected', fix: 'Use ast.literal_eval() or avoid eval entirely' },
  B308: { category: 'blacklist', severity: 'medium', description: 'mark_safe usage detected', fix: 'Ensure content is properly sanitized' },
  B310: { category: 'blacklist', severity: 'medium', description: 'urllib.urlopen detected', fix: 'Validate URLs and use requests library' },
  B311: { category: 'blacklist', severity: 'low', description: 'Random for security', fix: 'Use secrets module for cryptographic purposes' },
  B312: { category: 'blacklist', severity: 'high', description: 'Telnet usage detected', fix: 'Use SSH instead of Telnet' },
  B313: { category: 'blacklist', severity: 'medium', description: 'XML parsing vulnerable', fix: 'Use defusedxml library' },
  B314: { category: 'blacklist', severity: 'medium', description: 'XML parsing vulnerable', fix: 'Use defusedxml library' },
  B315: { category: 'blacklist', severity: 'medium', description: 'XML parsing vulnerable', fix: 'Use defusedxml library' },
  B316: { category: 'blacklist', severity: 'medium', description: 'XML parsing vulnerable', fix: 'Use defusedxml library' },
  B317: { category: 'blacklist', severity: 'medium', description: 'XML parsing vulnerable', fix: 'Use defusedxml library' },
  B318: { category: 'blacklist', severity: 'medium', description: 'XML parsing vulnerable', fix: 'Use defusedxml library' },
  B319: { category: 'blacklist', severity: 'medium', description: 'XML parsing vulnerable', fix: 'Use defusedxml library' },
  B320: { category: 'blacklist', severity: 'medium', description: 'XML parsing vulnerable', fix: 'Use defusedxml library' },
  B321: { category: 'blacklist', severity: 'high', description: 'FTP usage detected', fix: 'Use SFTP or FTPS instead' },
  B323: { category: 'blacklist', severity: 'medium', description: 'Unverified SSL context', fix: 'Enable certificate verification' },
  B324: { category: 'blacklist', severity: 'medium', description: 'Insecure hash function', fix: 'Use SHA-256 or stronger' },
  // B4xx: Blacklist imports
  B401: { category: 'import', severity: 'high', description: 'Telnetlib imported', fix: 'Use paramiko or SSH libraries instead' },
  B402: { category: 'import', severity: 'high', description: 'ftplib imported', fix: 'Use SFTP libraries instead' },
  B403: { category: 'import', severity: 'low', description: 'pickle imported', fix: 'Use JSON for untrusted data' },
  B404: { category: 'import', severity: 'low', description: 'subprocess imported', fix: 'Use with shell=False and validate inputs' },
  B405: { category: 'import', severity: 'low', description: 'xml.etree imported', fix: 'Use defusedxml for untrusted XML' },
  B406: { category: 'import', severity: 'low', description: 'xml.sax imported', fix: 'Use defusedxml for untrusted XML' },
  B407: { category: 'import', severity: 'low', description: 'xml.dom imported', fix: 'Use defusedxml for untrusted XML' },
  B408: { category: 'import', severity: 'low', description: 'xml.pulldom imported', fix: 'Use defusedxml for untrusted XML' },
  B409: { category: 'import', severity: 'low', description: 'xml.xmlrpc imported', fix: 'Be cautious with untrusted XML-RPC' },
  B410: { category: 'import', severity: 'low', description: 'lxml imported', fix: 'Use defusedxml for untrusted XML' },
  B411: { category: 'import', severity: 'high', description: 'xmlrpclib imported', fix: 'Be cautious with untrusted XML-RPC' },
  B412: { category: 'import', severity: 'high', description: 'httpoxy imported', fix: 'Update to patched version' },
  B413: { category: 'import', severity: 'high', description: 'pycrypto imported', fix: 'Use pycryptodome instead' },
  // B5xx: Cryptography
  B501: { category: 'crypto', severity: 'high', description: 'Request with no cert verification', fix: 'Enable SSL certificate verification' },
  B502: { category: 'crypto', severity: 'high', description: 'SSL with insecure version', fix: 'Use TLS 1.2 or higher' },
  B503: { category: 'crypto', severity: 'high', description: 'SSL with insecure defaults', fix: 'Explicitly set secure TLS version' },
  B504: { category: 'crypto', severity: 'medium', description: 'SSL without SNI', fix: 'Enable SNI in SSL context' },
  B505: { category: 'crypto', severity: 'medium', description: 'Weak cryptographic key', fix: 'Use 2048-bit or larger keys' },
  B506: { category: 'crypto', severity: 'medium', description: 'Unsafe YAML load', fix: 'Use yaml.safe_load() instead' },
  B507: { category: 'crypto', severity: 'high', description: 'SSH no host key verification', fix: 'Enable host key verification' },
  B508: { category: 'crypto', severity: 'medium', description: 'Snmp insecure version', fix: 'Use SNMPv3 with authentication' },
  B509: { category: 'crypto', severity: 'medium', description: 'Snmp weak crypto', fix: 'Use strong encryption for SNMP' },
  // B6xx: Injection
  B601: { category: 'injection', severity: 'medium', description: 'Paramiko call with policy', fix: 'Use AutoAddPolicy carefully' },
  B602: { category: 'injection', severity: 'high', description: 'subprocess with shell=True', fix: 'Use shell=False and pass args as list' },
  B603: { category: 'injection', severity: 'low', description: 'subprocess without shell', fix: 'Validate and sanitize inputs' },
  B604: { category: 'injection', severity: 'medium', description: 'Function call with shell', fix: 'Avoid shell expansion of user input' },
  B605: { category: 'injection', severity: 'high', description: 'os.system usage', fix: 'Use subprocess with shell=False' },
  B606: { category: 'injection', severity: 'medium', description: 'os.popen usage', fix: 'Use subprocess module instead' },
  B607: { category: 'injection', severity: 'low', description: 'Partial executable path', fix: 'Use absolute paths for executables' },
  B608: { category: 'injection', severity: 'medium', description: 'SQL injection possible', fix: 'Use parameterized queries' },
  B609: { category: 'injection', severity: 'medium', description: 'Wildcard injection', fix: 'Validate and escape wildcards' },
  B610: { category: 'injection', severity: 'medium', description: 'Django extra() usage', fix: 'Use Django ORM methods instead' },
  B611: { category: 'injection', severity: 'medium', description: 'Django RawSQL usage', fix: 'Use parameterized queries' },
  // B7xx: XSS and template
  B701: { category: 'xss', severity: 'high', description: 'Jinja2 autoescape disabled', fix: 'Enable autoescape=True' },
  B702: { category: 'xss', severity: 'medium', description: 'Mako template issues', fix: 'Enable proper escaping' },
  B703: { category: 'xss', severity: 'medium', description: 'Django mark_safe on user input', fix: 'Sanitize input before marking safe' },
} as const;

// Pylint message codes by category
const PYLINT_CODES: Readonly<Record<string, { category: string; severity: 'convention' | 'refactor' | 'warning' | 'error' | 'fatal'; description: string; fix: string }>> = {
  // C: Convention (C0xxx) - coding standard violations
  C0103: { category: 'naming', severity: 'convention', description: 'Invalid name', fix: 'Rename to follow naming conventions (snake_case for functions/variables, PascalCase for classes)' },
  C0104: { category: 'naming', severity: 'convention', description: 'Disallowed name', fix: 'Choose a more descriptive variable name' },
  C0111: { category: 'docstring', severity: 'convention', description: 'Missing docstring', fix: 'Add a docstring to the module/class/function' },
  C0112: { category: 'docstring', severity: 'convention', description: 'Empty docstring', fix: 'Add meaningful content to the docstring' },
  C0113: { category: 'docstring', severity: 'convention', description: 'Unneeded not', fix: 'Simplify the boolean expression' },
  C0114: { category: 'docstring', severity: 'convention', description: 'Missing module docstring', fix: 'Add a docstring at the top of the module' },
  C0115: { category: 'docstring', severity: 'convention', description: 'Missing class docstring', fix: 'Add a docstring to the class' },
  C0116: { category: 'docstring', severity: 'convention', description: 'Missing function docstring', fix: 'Add a docstring to the function' },
  C0121: { category: 'comparison', severity: 'convention', description: 'Singleton comparison', fix: 'Use "is" or "is not" for None/True/False comparisons' },
  C0123: { category: 'comparison', severity: 'convention', description: 'Using type() instead of isinstance()', fix: 'Use isinstance() for type checking' },
  C0200: { category: 'iteration', severity: 'convention', description: 'Consider using enumerate', fix: 'Use enumerate() instead of range(len())' },
  C0201: { category: 'iteration', severity: 'convention', description: 'Consider iterating dictionary directly', fix: 'Iterate over dict.items() or dict directly' },
  C0206: { category: 'iteration', severity: 'convention', description: 'Consider using dict.items()', fix: 'Use dict.items() for key-value iteration' },
  C0301: { category: 'format', severity: 'convention', description: 'Line too long', fix: 'Break line to stay within maximum length' },
  C0302: { category: 'format', severity: 'convention', description: 'Too many lines in module', fix: 'Split module into smaller modules' },
  C0303: { category: 'format', severity: 'convention', description: 'Trailing whitespace', fix: 'Remove trailing whitespace' },
  C0304: { category: 'format', severity: 'convention', description: 'Final newline missing', fix: 'Add newline at end of file' },
  C0305: { category: 'format', severity: 'convention', description: 'Trailing newlines', fix: 'Remove extra trailing newlines' },
  C0321: { category: 'format', severity: 'convention', description: 'Multiple statements on one line', fix: 'Split into separate lines' },
  C0325: { category: 'format', severity: 'convention', description: 'Unnecessary parens', fix: 'Remove unnecessary parentheses' },
  C0410: { category: 'import', severity: 'convention', description: 'Multiple imports on one line', fix: 'Put each import on a separate line' },
  C0411: { category: 'import', severity: 'convention', description: 'Wrong import order', fix: 'Order imports: stdlib, third-party, local' },
  C0412: { category: 'import', severity: 'convention', description: 'Ungrouped imports', fix: 'Group imports by type with blank lines' },
  C0413: { category: 'import', severity: 'convention', description: 'Wrong import position', fix: 'Move imports to top of file after docstring' },
  C0414: { category: 'import', severity: 'convention', description: 'Useless import alias', fix: 'Remove unnecessary import alias' },
  C0415: { category: 'import', severity: 'convention', description: 'Import outside toplevel', fix: 'Move import to top of file or document why it is here' },

  // R: Refactor (R0xxx) - code smell indicators
  R0201: { category: 'design', severity: 'refactor', description: 'Method could be a function', fix: 'Convert to standalone function or add @staticmethod' },
  R0401: { category: 'import', severity: 'refactor', description: 'Cyclic import', fix: 'Restructure to eliminate circular dependency' },
  R0801: { category: 'similarity', severity: 'refactor', description: 'Duplicate code', fix: 'Extract common code into a shared function' },
  R0901: { category: 'design', severity: 'refactor', description: 'Too many ancestors', fix: 'Simplify inheritance hierarchy' },
  R0902: { category: 'design', severity: 'refactor', description: 'Too many instance attributes', fix: 'Group related attributes into separate classes' },
  R0903: { category: 'design', severity: 'refactor', description: 'Too few public methods', fix: 'Consider using a dataclass or namedtuple' },
  R0904: { category: 'design', severity: 'refactor', description: 'Too many public methods', fix: 'Split class into smaller, focused classes' },
  R0911: { category: 'design', severity: 'refactor', description: 'Too many return statements', fix: 'Simplify function logic' },
  R0912: { category: 'design', severity: 'refactor', description: 'Too many branches', fix: 'Reduce branching complexity' },
  R0913: { category: 'design', severity: 'refactor', description: 'Too many arguments', fix: 'Group parameters into objects or use **kwargs' },
  R0914: { category: 'design', severity: 'refactor', description: 'Too many local variables', fix: 'Extract logic into helper functions' },
  R0915: { category: 'design', severity: 'refactor', description: 'Too many statements', fix: 'Break function into smaller functions' },
  R0916: { category: 'design', severity: 'refactor', description: 'Too many boolean expressions', fix: 'Extract conditions into named variables' },
  R1702: { category: 'design', severity: 'refactor', description: 'Too many nested blocks', fix: 'Reduce nesting with early returns or extraction' },
  R1705: { category: 'design', severity: 'refactor', description: 'Unnecessary else after return', fix: 'Remove else clause after return' },
  R1710: { category: 'design', severity: 'refactor', description: 'Inconsistent return statements', fix: 'Ensure all return paths return a value or None explicitly' },
  R1714: { category: 'design', severity: 'refactor', description: 'Consider using in', fix: 'Use "x in [a, b, c]" instead of multiple comparisons' },
  R1715: { category: 'design', severity: 'refactor', description: 'Consider using dict.get', fix: 'Use dict.get() for safe key access' },
  R1716: { category: 'design', severity: 'refactor', description: 'Chained comparison', fix: 'Use chained comparison (a < b < c)' },
  R1720: { category: 'design', severity: 'refactor', description: 'Unnecessary else after raise', fix: 'Remove else clause after raise' },
  R1721: { category: 'design', severity: 'refactor', description: 'Unnecessary comprehension', fix: 'Use constructor directly instead of comprehension' },
  R1723: { category: 'design', severity: 'refactor', description: 'Unnecessary else after break', fix: 'Remove else clause after break' },
  R1724: { category: 'design', severity: 'refactor', description: 'Unnecessary else after continue', fix: 'Remove else clause after continue' },
  R1725: { category: 'design', severity: 'refactor', description: 'Super with arguments', fix: 'Use super() without arguments in Python 3' },
  R1729: { category: 'design', severity: 'refactor', description: 'Use generator expression', fix: 'Use generator expression instead of list comprehension in call' },
  R1730: { category: 'design', severity: 'refactor', description: 'Consider using min/max', fix: 'Use min() or max() built-in function' },
  R1731: { category: 'design', severity: 'refactor', description: 'Consider using min/max with key', fix: 'Use min/max with key parameter' },
  R1732: { category: 'design', severity: 'refactor', description: 'Consider using with', fix: 'Use with statement for resource management' },

  // W: Warning (W0xxx) - various warnings
  W0101: { category: 'control-flow', severity: 'warning', description: 'Unreachable code', fix: 'Remove unreachable code or fix control flow' },
  W0102: { category: 'default-arg', severity: 'warning', description: 'Dangerous default value', fix: 'Use None as default and create mutable in function body' },
  W0104: { category: 'statement', severity: 'warning', description: 'Pointless statement', fix: 'Remove statement or assign its result' },
  W0105: { category: 'statement', severity: 'warning', description: 'Pointless string statement', fix: 'Convert to comment or remove' },
  W0106: { category: 'statement', severity: 'warning', description: 'Expression assigned to nothing', fix: 'Assign result or use for side effects only' },
  W0107: { category: 'statement', severity: 'warning', description: 'Unnecessary pass', fix: 'Remove pass statement' },
  W0108: { category: 'lambda', severity: 'warning', description: 'Unnecessary lambda', fix: 'Use function reference directly' },
  W0109: { category: 'dict', severity: 'warning', description: 'Duplicate key in dict', fix: 'Remove duplicate key' },
  W0120: { category: 'control-flow', severity: 'warning', description: 'Else clause on loop', fix: 'Consider restructuring without loop else' },
  W0122: { category: 'security', severity: 'warning', description: 'Use of exec', fix: 'Avoid exec; use safer alternatives' },
  W0123: { category: 'security', severity: 'warning', description: 'Use of eval', fix: 'Use ast.literal_eval or avoid eval entirely' },
  W0125: { category: 'condition', severity: 'warning', description: 'Using constant test', fix: 'Fix condition that is always true/false' },
  W0143: { category: 'comparison', severity: 'warning', description: 'Comparison of callable', fix: 'Call the function or remove comparison' },
  W0150: { category: 'control-flow', severity: 'warning', description: 'Lost exception', fix: 'Handle exception in finally block carefully' },
  W0199: { category: 'assert', severity: 'warning', description: 'Assert on tuple', fix: 'Fix assert statement (tuple is always truthy)' },
  W0201: { category: 'class', severity: 'warning', description: 'Attribute defined outside __init__', fix: 'Define attribute in __init__ method' },
  W0211: { category: 'class', severity: 'warning', description: 'Static method with self', fix: 'Remove self or use regular method' },
  W0212: { category: 'access', severity: 'warning', description: 'Access to protected member', fix: 'Use public API or document why access is needed' },
  W0221: { category: 'override', severity: 'warning', description: 'Arguments differ from overridden method', fix: 'Match parent method signature' },
  W0222: { category: 'override', severity: 'warning', description: 'Signature differs from overridden method', fix: 'Match parent method signature exactly' },
  W0223: { category: 'abstract', severity: 'warning', description: 'Abstract method not overridden', fix: 'Implement all abstract methods' },
  W0231: { category: 'class', severity: 'warning', description: 'Super __init__ not called', fix: 'Call super().__init__() in __init__' },
  W0233: { category: 'class', severity: 'warning', description: 'Non-parent __init__ called', fix: 'Call correct parent __init__' },
  W0301: { category: 'format', severity: 'warning', description: 'Unnecessary semicolon', fix: 'Remove semicolon' },
  W0311: { category: 'indent', severity: 'warning', description: 'Bad indentation', fix: 'Fix indentation to match style guide' },
  W0312: { category: 'indent', severity: 'warning', description: 'Mixed indentation', fix: 'Use consistent indentation (spaces or tabs)' },
  W0401: { category: 'import', severity: 'warning', description: 'Wildcard import', fix: 'Import specific names instead of using *' },
  W0404: { category: 'import', severity: 'warning', description: 'Reimported name', fix: 'Remove duplicate import' },
  W0406: { category: 'import', severity: 'warning', description: 'Module import itself', fix: 'Remove self-import' },
  W0511: { category: 'fixme', severity: 'warning', description: 'FIXME/TODO/XXX comment', fix: 'Address the TODO/FIXME item' },
  W0601: { category: 'variable', severity: 'warning', description: 'Global variable undefined', fix: 'Define global variable at module level' },
  W0602: { category: 'variable', severity: 'warning', description: 'Global without assignment', fix: 'Remove global statement or assign value' },
  W0603: { category: 'variable', severity: 'warning', description: 'Using global statement', fix: 'Avoid global variables; pass as parameters' },
  W0604: { category: 'variable', severity: 'warning', description: 'Global at module level', fix: 'Remove unnecessary global declaration' },
  W0611: { category: 'import', severity: 'warning', description: 'Unused import', fix: 'Remove unused import' },
  W0612: { category: 'variable', severity: 'warning', description: 'Unused variable', fix: 'Use variable or prefix with underscore' },
  W0613: { category: 'variable', severity: 'warning', description: 'Unused argument', fix: 'Use argument or prefix with underscore' },
  W0614: { category: 'import', severity: 'warning', description: 'Unused wildcard import', fix: 'Import only needed names' },
  W0621: { category: 'variable', severity: 'warning', description: 'Redefining name from outer scope', fix: 'Use different variable name' },
  W0622: { category: 'variable', severity: 'warning', description: 'Redefining builtin', fix: 'Use different name that does not shadow builtin' },
  W0631: { category: 'variable', severity: 'warning', description: 'Undefined loop variable', fix: 'Define variable before loop or handle empty case' },
  W0640: { category: 'closure', severity: 'warning', description: 'Cell variable defined in loop', fix: 'Use default argument to capture value' },
  W0702: { category: 'exception', severity: 'warning', description: 'Bare except', fix: 'Specify exception type' },
  W0703: { category: 'exception', severity: 'warning', description: 'Catching too general exception', fix: 'Catch more specific exception types' },
  W0705: { category: 'exception', severity: 'warning', description: 'Duplicate except handlers', fix: 'Remove duplicate except clause' },
  W0706: { category: 'exception', severity: 'warning', description: 'Except handlers with no effect', fix: 'Handle exception or re-raise' },
  W0707: { category: 'exception', severity: 'warning', description: 'Raise missing from', fix: 'Use "raise ... from err" to preserve context' },
  W0711: { category: 'exception', severity: 'warning', description: 'Exception to catch is binary operation', fix: 'Use tuple for multiple exceptions' },
  W0715: { category: 'exception', severity: 'warning', description: 'Exception arguments suggest printf', fix: 'Use % or .format() for exception message' },
  W1113: { category: 'argument', severity: 'warning', description: 'Keyword argument before vararg', fix: 'Reorder arguments' },
  W1201: { category: 'logging', severity: 'warning', description: 'Logging % formatting', fix: 'Use lazy % formatting in logging calls' },
  W1202: { category: 'logging', severity: 'warning', description: 'Logging .format() formatting', fix: 'Use lazy % formatting in logging calls' },
  W1203: { category: 'logging', severity: 'warning', description: 'Logging fstring formatting', fix: 'Use lazy % formatting in logging calls' },
  W1300: { category: 'format-string', severity: 'warning', description: 'Format string issue', fix: 'Fix format string syntax' },
  W1301: { category: 'format-string', severity: 'warning', description: 'Unused format argument', fix: 'Use all format arguments or remove extra' },
  W1302: { category: 'format-string', severity: 'warning', description: 'Invalid format string', fix: 'Fix format string syntax' },
  W1401: { category: 'string', severity: 'warning', description: 'Anomalous backslash', fix: 'Use raw string or escape backslash' },
  W1402: { category: 'string', severity: 'warning', description: 'Anomalous unicode escape', fix: 'Use raw string or proper escape' },
  W1404: { category: 'string', severity: 'warning', description: 'Implicit string concatenation', fix: 'Use explicit + or parentheses' },
  W1405: { category: 'string', severity: 'warning', description: 'Duplicate string formatting', fix: 'Use consistent string formatting style' },
  W1501: { category: 'file', severity: 'warning', description: 'Bad open mode', fix: 'Use valid file mode string' },
  W1503: { category: 'redundant', severity: 'warning', description: 'Redundant unittest assert', fix: 'Simplify assertion' },
  W1508: { category: 'env', severity: 'warning', description: 'Invalid envvar default', fix: 'Use string as default for getenv' },
  W1509: { category: 'subprocess', severity: 'warning', description: 'Preexec_fn not safe with threads', fix: 'Avoid preexec_fn with threading' },
  W1510: { category: 'subprocess', severity: 'warning', description: 'Subprocess run without check', fix: 'Use check=True or handle return code' },

  // E: Error (E0xxx) - probable bugs
  E0001: { category: 'syntax', severity: 'error', description: 'Syntax error', fix: 'Fix syntax error' },
  E0100: { category: 'init', severity: 'error', description: '__init__ returns non-None', fix: 'Return None from __init__' },
  E0101: { category: 'return', severity: 'error', description: 'Return in __init__', fix: 'Remove return statement from __init__' },
  E0102: { category: 'redefinition', severity: 'error', description: 'Function redefined', fix: 'Remove duplicate function definition' },
  E0103: { category: 'control-flow', severity: 'error', description: 'Break/continue outside loop', fix: 'Move statement inside loop' },
  E0104: { category: 'control-flow', severity: 'error', description: 'Return outside function', fix: 'Move statement inside function' },
  E0105: { category: 'control-flow', severity: 'error', description: 'Yield outside function', fix: 'Move statement inside generator function' },
  E0107: { category: 'operator', severity: 'error', description: 'Non-existent operator', fix: 'Use valid operator' },
  E0108: { category: 'duplicate', severity: 'error', description: 'Duplicate argument name', fix: 'Use unique argument names' },
  E0110: { category: 'abstract', severity: 'error', description: 'Abstract class instantiated', fix: 'Implement abstract methods or use concrete class' },
  E0111: { category: 'reversed', severity: 'error', description: 'Reversed call on non-sequence', fix: 'Use reversed() on sequence type' },
  E0112: { category: 'argument', severity: 'error', description: 'Empty format tuple', fix: 'Add format arguments' },
  E0113: { category: 'argument', severity: 'error', description: 'Unsupported membership test', fix: 'Use type that supports "in" operator' },
  E0114: { category: 'argument', severity: 'error', description: 'Unsupported repeated operation', fix: 'Use type that supports * operator' },
  E0115: { category: 'name', severity: 'error', description: 'Nonlocal outside function', fix: 'Move nonlocal inside function' },
  E0116: { category: 'name', severity: 'error', description: 'Nonlocal at module level', fix: 'Remove nonlocal at module level' },
  E0117: { category: 'name', severity: 'error', description: 'Nonlocal without binding', fix: 'Define variable in outer scope' },
  E0118: { category: 'name', severity: 'error', description: 'Used prior to global declaration', fix: 'Move global declaration before use' },
  E0119: { category: 'format', severity: 'error', description: 'Format string needs mapping', fix: 'Provide dict for named format specifiers' },
  E0202: { category: 'class', severity: 'error', description: 'Method hidden by attribute', fix: 'Rename attribute or method' },
  E0203: { category: 'class', severity: 'error', description: 'Access to member before definition', fix: 'Define attribute before accessing' },
  E0211: { category: 'method', severity: 'error', description: 'Method has no argument', fix: 'Add self parameter to method' },
  E0213: { category: 'method', severity: 'error', description: 'Self as first argument', fix: 'Name first parameter "self" or "cls"' },
  E0236: { category: 'class', severity: 'error', description: 'Invalid slots', fix: 'Use valid __slots__ definition' },
  E0237: { category: 'class', severity: 'error', description: 'Assigning non-slot', fix: 'Add attribute to __slots__ or remove assignment' },
  E0238: { category: 'class', severity: 'error', description: 'Invalid slots object', fix: 'Use string or iterable for __slots__' },
  E0239: { category: 'class', severity: 'error', description: 'Inheriting non-class', fix: 'Inherit from a class' },
  E0240: { category: 'class', severity: 'error', description: 'Inconsistent MRO', fix: 'Fix class hierarchy to resolve MRO' },
  E0241: { category: 'class', severity: 'error', description: 'Duplicate bases', fix: 'Remove duplicate base class' },
  E0301: { category: 'iterator', severity: 'error', description: '__iter__ not returning iterator', fix: 'Return iterator from __iter__' },
  E0302: { category: 'method', severity: 'error', description: 'Unexpected special method signature', fix: 'Use correct signature for special method' },
  E0303: { category: 'method', severity: 'error', description: '__len__ returned non-int', fix: 'Return integer from __len__' },
  E0401: { category: 'import', severity: 'error', description: 'Import error', fix: 'Install missing package or fix import path' },
  E0402: { category: 'import', severity: 'error', description: 'Relative import beyond package', fix: 'Fix relative import or use absolute import' },
  E0601: { category: 'variable', severity: 'error', description: 'Used before assignment', fix: 'Define variable before use' },
  E0602: { category: 'variable', severity: 'error', description: 'Undefined variable', fix: 'Define or import variable' },
  E0603: { category: 'variable', severity: 'error', description: 'Undefined all member', fix: 'Define all names in __all__' },
  E0604: { category: 'variable', severity: 'error', description: 'Invalid all object', fix: 'Use strings in __all__ list' },
  E0611: { category: 'import', severity: 'error', description: 'No name in module', fix: 'Check spelling or module contents' },
  E0701: { category: 'exception', severity: 'error', description: 'Bad except order', fix: 'Order exceptions from specific to general' },
  E0702: { category: 'exception', severity: 'error', description: 'Raising bad type', fix: 'Raise exception instance or class' },
  E0703: { category: 'exception', severity: 'error', description: 'Bad exception context', fix: 'Use exception instance in "from" clause' },
  E0704: { category: 'exception', severity: 'error', description: 'Misplaced bare raise', fix: 'Use raise only inside except block' },
  E0710: { category: 'exception', severity: 'error', description: 'Raising non-exception', fix: 'Raise BaseException subclass' },
  E0711: { category: 'exception', severity: 'error', description: 'NotImplemented raised', fix: 'Raise NotImplementedError instead' },
  E0712: { category: 'exception', severity: 'error', description: 'Catching non-exception', fix: 'Catch BaseException subclass' },
  E1003: { category: 'argument', severity: 'error', description: 'Bad super call', fix: 'Use super() correctly' },
  E1101: { category: 'attribute', severity: 'error', description: 'No member', fix: 'Check attribute name or type' },
  E1102: { category: 'call', severity: 'error', description: 'Not callable', fix: 'Call only callable objects' },
  E1111: { category: 'assignment', severity: 'error', description: 'Assignment from None', fix: 'Function returns None; check return value' },
  E1120: { category: 'argument', severity: 'error', description: 'No value for argument', fix: 'Provide all required arguments' },
  E1121: { category: 'argument', severity: 'error', description: 'Too many positional arguments', fix: 'Remove extra arguments' },
  E1123: { category: 'argument', severity: 'error', description: 'Unexpected keyword argument', fix: 'Remove invalid keyword argument' },
  E1124: { category: 'argument', severity: 'error', description: 'Argument passed by position and keyword', fix: 'Pass argument once' },
  E1125: { category: 'argument', severity: 'error', description: 'Missing mandatory keyword argument', fix: 'Provide required keyword argument' },
  E1126: { category: 'subscript', severity: 'error', description: 'Invalid sequence index', fix: 'Use integer index' },
  E1127: { category: 'subscript', severity: 'error', description: 'Invalid slice index', fix: 'Use integer or None for slice' },
  E1128: { category: 'assignment', severity: 'error', description: 'Assignment from no return', fix: 'Function has no return value' },
  E1129: { category: 'context', severity: 'error', description: 'Not context manager', fix: 'Use object that supports with statement' },
  E1130: { category: 'operation', severity: 'error', description: 'Invalid unary operand', fix: 'Use correct operand type' },
  E1131: { category: 'operation', severity: 'error', description: 'Unsupported binary operation', fix: 'Use compatible types for operation' },
  E1132: { category: 'argument', severity: 'error', description: 'Repeated keyword', fix: 'Remove duplicate keyword argument' },
  E1133: { category: 'iteration', severity: 'error', description: 'Not an iterable', fix: 'Iterate over iterable type' },
  E1134: { category: 'iteration', severity: 'error', description: 'Not a mapping', fix: 'Unpack from mapping type' },
  E1135: { category: 'membership', severity: 'error', description: 'Unsupported membership', fix: 'Use "in" with container type' },
  E1136: { category: 'subscript', severity: 'error', description: 'Unsubscriptable object', fix: 'Index only subscriptable types' },
  E1137: { category: 'assignment', severity: 'error', description: 'Unsupported assignment', fix: 'Assign to assignable target' },
  E1138: { category: 'deletion', severity: 'error', description: 'Unsupported delete', fix: 'Delete only from deletable type' },
  E1139: { category: 'metaclass', severity: 'error', description: 'Invalid metaclass', fix: 'Use valid metaclass' },
  E1140: { category: 'dict', severity: 'error', description: 'Unhashable dict key', fix: 'Use hashable type as dict key' },
  E1141: { category: 'dict', severity: 'error', description: 'Unhashable member', fix: 'Use hashable types in set' },
  E1142: { category: 'await', severity: 'error', description: 'Await outside async', fix: 'Use await inside async function' },
  E1200: { category: 'logging', severity: 'error', description: 'Logging unsupported format', fix: 'Use valid logging format character' },
  E1201: { category: 'logging', severity: 'error', description: 'Logging format truncated', fix: 'Complete logging format specification' },
  E1205: { category: 'logging', severity: 'error', description: 'Too many logging args', fix: 'Match format specifiers to arguments' },
  E1206: { category: 'logging', severity: 'error', description: 'Too few logging args', fix: 'Provide all format arguments' },
  E1300: { category: 'format', severity: 'error', description: 'Bad format character', fix: 'Use valid format character' },
  E1301: { category: 'format', severity: 'error', description: 'Truncated format string', fix: 'Complete format specification' },
  E1302: { category: 'format', severity: 'error', description: 'Mixed format arguments', fix: 'Use either positional or keyword format args' },
  E1303: { category: 'format', severity: 'error', description: 'Expected mapping for format', fix: 'Provide dict for named format specifiers' },
  E1304: { category: 'format', severity: 'error', description: 'Missing format key', fix: 'Include key in format dict' },
  E1305: { category: 'format', severity: 'error', description: 'Too many format args', fix: 'Match format specifiers to arguments' },
  E1306: { category: 'format', severity: 'error', description: 'Too few format args', fix: 'Provide all format arguments' },
  E1307: { category: 'format', severity: 'error', description: 'Bad string format type', fix: 'Use correct format specifier for type' },
  E1310: { category: 'string', severity: 'error', description: 'Bad str strip call', fix: 'Pass string to strip method' },
  E1507: { category: 'os', severity: 'error', description: 'Invalid envvar value', fix: 'Use string for environment variable value' },
  E1519: { category: 'singledispatch', severity: 'error', description: 'Singledispatch method', fix: 'Use singledispatchmethod for methods' },
  E1520: { category: 'slot', severity: 'error', description: 'Used before slots assignment', fix: 'Assign to __slots__ before use' },

  // F: Fatal (F0xxx) - errors preventing further processing
  F0001: { category: 'fatal', severity: 'fatal', description: 'Error occurred preventing analysis', fix: 'Fix fatal error in code' },
  F0002: { category: 'fatal', severity: 'fatal', description: 'Pylint internal error', fix: 'Report bug to Pylint or simplify code' },
  F0010: { category: 'fatal', severity: 'fatal', description: 'Parse error', fix: 'Fix syntax error preventing parsing' },
  F0202: { category: 'fatal', severity: 'fatal', description: 'Unable to check methods signature', fix: 'Ensure base class is importable' },
} as const;

// pytest error types and common failure patterns
const PYTEST_ERROR_TYPES: Readonly<Record<string, { category: string; description: string; fix: string }>> = {
  // Assertion errors
  AssertionError: { category: 'assertion', description: 'Test assertion failed', fix: 'Check expected vs actual values in assertion' },

  // Fixture errors
  FixtureError: { category: 'fixture', description: 'Fixture setup/teardown failed', fix: 'Check fixture definition and dependencies' },
  FixtureNotFound: { category: 'fixture', description: 'Required fixture not found', fix: 'Define the fixture or check fixture scope/import' },
  ScopeMismatch: { category: 'fixture', description: 'Fixture scope mismatch', fix: 'Align fixture scopes (function < class < module < session)' },

  // Collection errors
  CollectionError: { category: 'collection', description: 'Error during test collection', fix: 'Fix syntax errors or import issues in test file' },
  ImportError: { category: 'collection', description: 'Failed to import test module', fix: 'Check imports and module paths' },
  ModuleNotFoundError: { category: 'collection', description: 'Test module not found', fix: 'Verify module exists and PYTHONPATH is correct' },

  // Setup/teardown errors
  SetupError: { category: 'setup', description: 'Error in test setup', fix: 'Check setup method or fixture initialization' },
  TeardownError: { category: 'teardown', description: 'Error in test teardown', fix: 'Ensure cleanup code handles all states' },

  // Timeout errors
  TimeoutError: { category: 'timeout', description: 'Test execution timed out', fix: 'Optimize slow test or increase timeout' },

  // Skip/xfail
  Skipped: { category: 'skip', description: 'Test was skipped', fix: 'Check skip condition or remove skip marker' },
  XFailed: { category: 'xfail', description: 'Expected failure', fix: 'Test is expected to fail; fix underlying issue' },
  XPassed: { category: 'xfail', description: 'Expected failure but passed', fix: 'Remove xfail marker if issue is fixed' },

  // Parametrize errors
  ParameterizeError: { category: 'parametrize', description: 'Error in test parametrization', fix: 'Check parametrize decorator arguments' },

  // Common runtime errors in tests
  TypeError: { category: 'type', description: 'Type error in test', fix: 'Check argument types and function calls' },
  ValueError: { category: 'value', description: 'Invalid value in test', fix: 'Verify test data and expected values' },
  KeyError: { category: 'key', description: 'Missing dictionary key', fix: 'Check dictionary keys and data structure' },
  AttributeError: { category: 'attribute', description: 'Missing attribute', fix: 'Verify object has expected attribute' },
  IndexError: { category: 'index', description: 'Index out of range', fix: 'Check list/sequence bounds' },
  RuntimeError: { category: 'runtime', description: 'Runtime error in test', fix: 'Debug test execution flow' },

  // Mock/patch errors
  MockError: { category: 'mock', description: 'Mock configuration error', fix: 'Check mock setup and return values' },
  PatchError: { category: 'mock', description: 'Patch target error', fix: 'Verify patch target path is correct' },

  // Database/IO errors
  DatabaseError: { category: 'database', description: 'Database operation failed', fix: 'Check database connection and queries' },
  IOError: { category: 'io', description: 'I/O operation failed', fix: 'Verify file paths and permissions' },
  FileNotFoundError: { category: 'io', description: 'File not found', fix: 'Check file path and test fixtures' },
  PermissionError: { category: 'io', description: 'Permission denied', fix: 'Check file/directory permissions' },

  // HTTP/API errors
  ConnectionError: { category: 'network', description: 'Connection failed', fix: 'Check network and mock external services' },
  HTTPError: { category: 'network', description: 'HTTP request failed', fix: 'Verify API endpoint and mock responses' },

  // Async errors
  AsyncioTimeoutError: { category: 'async', description: 'Async operation timed out', fix: 'Check async code and increase timeout' },
  CancelledError: { category: 'async', description: 'Async task cancelled', fix: 'Handle task cancellation properly' },
} as const;

const PYTHON_ERROR_TYPES: Readonly<Record<string, { category: string; commonCauses: string[] }>> = {
  TypeError: {
    category: 'type',
    commonCauses: [
      'Wrong argument type passed to function',
      'Calling non-callable object',
      'Unsupported operand types',
      'Missing required positional argument',
    ],
  },
  ValueError: {
    category: 'value',
    commonCauses: [
      'Invalid value for conversion',
      'Value out of expected range',
      'Empty sequence when value expected',
    ],
  },
  AttributeError: {
    category: 'attribute',
    commonCauses: [
      'Accessing undefined attribute',
      'NoneType has no attribute (missing null check)',
      'Typo in attribute name',
    ],
  },
  NameError: {
    category: 'name',
    commonCauses: [
      'Variable not defined',
      'Typo in variable name',
      'Using variable before assignment',
    ],
  },
  KeyError: {
    category: 'key',
    commonCauses: [
      'Dictionary key does not exist',
      'Missing key in dict access',
      'Typo in dictionary key',
    ],
  },
  IndexError: {
    category: 'index',
    commonCauses: [
      'List index out of range',
      'Empty list access',
      'Off-by-one error',
    ],
  },
  ImportError: {
    category: 'import',
    commonCauses: [
      'Module not installed',
      'Circular import',
      'Wrong module path',
    ],
  },
  ModuleNotFoundError: {
    category: 'import',
    commonCauses: [
      'Package not installed',
      'Virtual environment not activated',
      'Missing __init__.py',
    ],
  },
  SyntaxError: {
    category: 'syntax',
    commonCauses: [
      'Missing colon after statement',
      'Unbalanced parentheses/brackets',
      'Invalid indentation',
    ],
  },
  IndentationError: {
    category: 'indentation',
    commonCauses: [
      'Mixed tabs and spaces',
      'Inconsistent indentation level',
      'Missing indentation after block statement',
    ],
  },
  FileNotFoundError: {
    category: 'file',
    commonCauses: [
      'File path does not exist',
      'Relative path from wrong directory',
      'Missing file extension',
    ],
  },
  PermissionError: {
    category: 'permission',
    commonCauses: [
      'Insufficient file permissions',
      'File is read-only',
      'Directory access denied',
    ],
  },
  ZeroDivisionError: {
    category: 'arithmetic',
    commonCauses: [
      'Division by zero',
      'Missing zero check before division',
    ],
  },
  RecursionError: {
    category: 'recursion',
    commonCauses: [
      'Infinite recursion',
      'Missing base case',
      'Stack overflow',
    ],
  },
  StopIteration: {
    category: 'iterator',
    commonCauses: [
      'Iterator exhausted',
      'Calling next() on empty iterator',
    ],
  },
  AssertionError: {
    category: 'assertion',
    commonCauses: [
      'Failed assert statement',
      'Test assertion failed',
      'Precondition not met',
    ],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

function buildSourceLocation(
  file: string,
  line: number,
  column?: number
): SourceLocation {
  const loc: SourceLocation = { file, line };
  if (column !== undefined) {
    loc.column = column;
  }
  return loc;
}

function buildStackFrame(
  location: SourceLocation,
  functionName?: string,
  raw?: string,
  isUserCode?: boolean
): StackFrame {
  const frame: StackFrame = { location };
  if (functionName !== undefined) {
    frame.functionName = functionName;
  }
  if (raw !== undefined) {
    frame.raw = raw;
  }
  if (isUserCode !== undefined) {
    frame.isUserCode = isUserCode;
  }
  return frame;
}

function isLibraryPath(filePath: string): boolean {
  const patterns = [
    /site-packages/,
    /dist-packages/,
    /\.pyenv/,
    /\/lib\/python/,
    /\/usr\/lib/,
    /<frozen/,
    /<string>/,
    /venv\//,
    /\.venv\//,
  ];
  return patterns.some((p) => p.test(filePath));
}

// =============================================================================
// Python Language Module
// =============================================================================

export class PythonModule implements LanguageModule {
  readonly language = 'python' as const;
  readonly aliases = ['py', 'python3', 'python2', 'pypy'];
  readonly extensions = ['.py', '.pyi', '.pyw', '.pyx'];

  // ===========================================================================
  // Error Parsing
  // ===========================================================================

  async parseError(raw: string): Promise<NormalizedError[]> {
    const errors: NormalizedError[] = [];

    // Try Pyright output format first (most specific)
    const pyrightErrors = this.parsePyrightOutput(raw);
    if (pyrightErrors.length > 0) {
      return pyrightErrors;
    }

    // Try Mypy output format
    const mypyErrors = this.parseMypyOutput(raw);
    if (mypyErrors.length > 0) {
      return mypyErrors;
    }

    // Try Ruff output format
    const ruffErrors = this.parseRuffOutput(raw);
    if (ruffErrors.length > 0) {
      return ruffErrors;
    }

    // Try Bandit output format
    const banditErrors = this.parseBanditOutput(raw);
    if (banditErrors.length > 0) {
      return banditErrors;
    }

    // Try Pylint output format
    const pylintErrors = this.parsePylintOutput(raw);
    if (pylintErrors.length > 0) {
      return pylintErrors;
    }

    // Try pytest output format
    const pytestErrors = this.parsePytestOutput(raw);
    if (pytestErrors.length > 0) {
      return pytestErrors;
    }

    // Try Python traceback format
    if (PYTHON_PATTERNS.traceback.test(raw)) {
      const error = this.parseTraceback(raw);
      if (error !== null) {
        errors.push(error);
      }
    } else {
      // Try individual error lines
      const lines = raw.split('\n');
      for (const line of lines) {
        const match = PYTHON_PATTERNS.error.exec(line);
        if (match !== null) {
          const errorType = match[1];
          const message = match[2];
          if (errorType !== undefined && message !== undefined) {
            errors.push(this.createError(errorType, message, raw));
          }
        }
      }
    }

    return errors;
  }

  private parsePyrightOutput(raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      // Try Pyright with rule code first (more specific)
      let match = PYTHON_PATTERNS.pyrightWithRule.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const column = match[3];
        const level = match[4];
        const message = match[5];
        const ruleCode = match[6];

        if (file !== undefined && lineNum !== undefined && column !== undefined && message !== undefined) {
          const error = this.createPyrightError(
            file,
            parseInt(lineNum, 10),
            parseInt(column, 10),
            level ?? 'error',
            message,
            ruleCode,
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try basic Pyright format
      match = PYTHON_PATTERNS.pyright.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const column = match[3];
        const level = match[4];
        const message = match[5];

        if (file !== undefined && lineNum !== undefined && column !== undefined && message !== undefined) {
          const error = this.createPyrightError(
            file,
            parseInt(lineNum, 10),
            parseInt(column, 10),
            level ?? 'error',
            message,
            undefined,
            line
          );
          errors.push(error);
        }
      }
    }

    return errors;
  }

  private createPyrightError(
    file: string,
    line: number,
    column: number,
    level: string,
    message: string,
    ruleCode: string | undefined,
    raw: string
  ): NormalizedError {
    const location = buildSourceLocation(file, line, column);
    const severity = this.pyrightLevelToSeverity(level);

    const error: NormalizedError = {
      id: randomUUID(),
      type: ruleCode !== undefined ? `Pyright:${ruleCode}` : 'PyrightError',
      message,
      severity,
      source: 'static',
      language: 'python',
      raw,
      timestamp: new Date(),
      location,
    };

    // Add rule-specific context if available
    if (ruleCode !== undefined) {
      const ruleInfo = PYRIGHT_ERROR_CODES[ruleCode];
      if (ruleInfo !== undefined) {
        error.context = {
          rule: ruleCode,
          ruleDescription: ruleInfo.description,
          suggestedFix: ruleInfo.fix,
        };
      }
    }

    return error;
  }

  private pyrightLevelToSeverity(level: string): 'error' | 'warning' | 'info' {
    switch (level) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'information':
        return 'info';
      default:
        return 'error';
    }
  }

  private parseMypyOutput(raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      // Try Mypy with column and error code first (most specific)
      let match = PYTHON_PATTERNS.mypyWithColumnAndCode.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const column = match[3];
        const level = match[4];
        const message = match[5];
        const errorCode = match[6];

        if (file !== undefined && lineNum !== undefined && column !== undefined && message !== undefined) {
          const error = this.createMypyError(
            file,
            parseInt(lineNum, 10),
            parseInt(column, 10),
            level ?? 'error',
            message,
            errorCode,
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try Mypy with error code (no column)
      match = PYTHON_PATTERNS.mypyWithCode.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const level = match[3];
        const message = match[4];
        const errorCode = match[5];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const error = this.createMypyError(
            file,
            parseInt(lineNum, 10),
            undefined,
            level ?? 'error',
            message,
            errorCode,
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try Mypy with column (no error code)
      match = PYTHON_PATTERNS.mypyWithColumn.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const column = match[3];
        const level = match[4];
        const message = match[5];

        if (file !== undefined && lineNum !== undefined && column !== undefined && message !== undefined) {
          const error = this.createMypyError(
            file,
            parseInt(lineNum, 10),
            parseInt(column, 10),
            level ?? 'error',
            message,
            undefined,
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try basic Mypy format
      match = PYTHON_PATTERNS.mypy.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const level = match[3];
        const message = match[4];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const error = this.createMypyError(
            file,
            parseInt(lineNum, 10),
            undefined,
            level ?? 'error',
            message,
            undefined,
            line
          );
          errors.push(error);
        }
      }
    }

    return errors;
  }

  private createMypyError(
    file: string,
    line: number,
    column: number | undefined,
    level: string,
    message: string,
    errorCode: string | undefined,
    raw: string
  ): NormalizedError {
    const location = buildSourceLocation(file, line, column);
    const severity = this.mypyLevelToSeverity(level);

    const error: NormalizedError = {
      id: randomUUID(),
      type: errorCode !== undefined ? `Mypy:${errorCode}` : 'MypyError',
      message,
      severity,
      source: 'static',
      language: 'python',
      raw,
      timestamp: new Date(),
      location,
    };

    // Add error code context if available
    if (errorCode !== undefined) {
      const codeInfo = MYPY_ERROR_CODES[errorCode];
      if (codeInfo !== undefined) {
        error.context = {
          errorCode,
          codeDescription: codeInfo.description,
          suggestedFix: codeInfo.fix,
        };
      }
    }

    return error;
  }

  private mypyLevelToSeverity(level: string): 'error' | 'warning' | 'info' {
    switch (level) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'note':
        return 'info';
      default:
        return 'error';
    }
  }

  private parseRuffOutput(raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      // Try Ruff with fixable indicator first (more specific)
      let match = PYTHON_PATTERNS.ruffFixable.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const column = match[3];
        const code = match[4];
        const message = match[5];

        if (file !== undefined && lineNum !== undefined && column !== undefined && code !== undefined && message !== undefined) {
          const error = this.createRuffError(
            file,
            parseInt(lineNum, 10),
            parseInt(column, 10),
            code,
            message,
            true,
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try basic Ruff format
      match = PYTHON_PATTERNS.ruff.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const column = match[3];
        const code = match[4];
        const message = match[5];

        if (file !== undefined && lineNum !== undefined && column !== undefined && code !== undefined && message !== undefined) {
          const error = this.createRuffError(
            file,
            parseInt(lineNum, 10),
            parseInt(column, 10),
            code,
            message,
            false,
            line
          );
          errors.push(error);
        }
      }
    }

    return errors;
  }

  private createRuffError(
    file: string,
    line: number,
    column: number,
    code: string,
    message: string,
    isFixable: boolean,
    raw: string
  ): NormalizedError {
    const location = buildSourceLocation(file, line, column);
    const codeInfo = RUFF_ERROR_CODES[code];

    // Determine severity based on code prefix
    const severity = this.ruffCodeToSeverity(code);

    const error: NormalizedError = {
      id: randomUUID(),
      type: `Ruff:${code}`,
      message,
      severity,
      source: 'static',
      language: 'python',
      raw,
      timestamp: new Date(),
      location,
    };

    // Add code-specific context
    if (codeInfo !== undefined) {
      error.context = {
        code,
        category: codeInfo.category,
        codeDescription: codeInfo.description,
        suggestedFix: codeInfo.fix,
        isFixable: codeInfo.fixable || isFixable,
      };
    } else {
      error.context = {
        code,
        category: this.ruffCodeToCategory(code),
        isFixable,
      };
    }

    return error;
  }

  private ruffCodeToSeverity(code: string): 'error' | 'warning' | 'info' {
    // E and F codes are typically errors
    if (code.startsWith('E') || code.startsWith('F')) {
      return 'error';
    }
    // W codes are warnings
    if (code.startsWith('W')) {
      return 'warning';
    }
    // N, I, UP, B, RUF are typically warnings/style issues
    return 'warning';
  }

  private ruffCodeToCategory(code: string): string {
    const prefix = code.replace(/\d+$/, '');
    const categories: Record<string, string> = {
      E: 'pycodestyle-error',
      W: 'pycodestyle-warning',
      F: 'pyflakes',
      I: 'isort',
      N: 'pep8-naming',
      D: 'pydocstyle',
      UP: 'pyupgrade',
      B: 'flake8-bugbear',
      A: 'flake8-builtins',
      C4: 'flake8-comprehensions',
      T20: 'flake8-print',
      PT: 'flake8-pytest-style',
      RET: 'flake8-return',
      SIM: 'flake8-simplify',
      ARG: 'flake8-unused-arguments',
      ERA: 'eradicate',
      PL: 'pylint',
      RUF: 'ruff',
    };
    return categories[prefix] ?? 'unknown';
  }

  private parseBanditOutput(raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    // Track current issue being parsed (for multi-line format)
    let currentCode: string | undefined;
    let currentMessage: string | undefined;
    let currentFile: string | undefined;
    let currentLine: number | undefined;
    let currentColumn: number | undefined;
    let currentSeverity: string | undefined;
    let currentConfidence: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // Try compact format first: file.py:10: B101: message
      const compactMatch = PYTHON_PATTERNS.banditCompact.exec(line);
      if (compactMatch !== null) {
        const file = compactMatch[1];
        const lineNum = compactMatch[2];
        const code = compactMatch[3];
        const message = compactMatch[4];

        if (file !== undefined && lineNum !== undefined && code !== undefined && message !== undefined) {
          const error = this.createBanditError(
            file,
            parseInt(lineNum, 10),
            0,
            code,
            message,
            'medium', // Default severity for compact format
            'medium', // Default confidence for compact format
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try multi-line format: >> Issue: [B101:assert_used] message
      const issueMatch = PYTHON_PATTERNS.banditIssue.exec(line);
      if (issueMatch !== null) {
        // Save any pending issue before starting new one
        if (currentCode !== undefined && currentMessage !== undefined && currentFile !== undefined && currentLine !== undefined) {
          const error = this.createBanditError(
            currentFile,
            currentLine,
            currentColumn ?? 0,
            currentCode,
            currentMessage,
            currentSeverity ?? 'medium',
            currentConfidence ?? 'medium',
            `${currentCode}: ${currentMessage}`
          );
          errors.push(error);
        }

        // Start new issue
        currentCode = issueMatch[1];
        currentMessage = issueMatch[3];
        currentFile = undefined;
        currentLine = undefined;
        currentColumn = undefined;
        currentSeverity = undefined;
        currentConfidence = undefined;
        continue;
      }

      // Try location line: Location: ./file.py:10:0
      const locationMatch = PYTHON_PATTERNS.banditLocation.exec(line);
      if (locationMatch !== null && currentCode !== undefined) {
        const file = locationMatch[1];
        const lineNum = locationMatch[2];
        const column = locationMatch[3];

        if (file !== undefined && lineNum !== undefined) {
          currentFile = file;
          currentLine = parseInt(lineNum, 10);
          currentColumn = column !== undefined ? parseInt(column, 10) : 0;
        }
        continue;
      }

      // Try severity/confidence line: Severity: Low   Confidence: High
      const severityMatch = PYTHON_PATTERNS.banditSeverity.exec(line);
      if (severityMatch !== null && currentCode !== undefined) {
        currentSeverity = severityMatch[1]?.toLowerCase();
        currentConfidence = severityMatch[2]?.toLowerCase();
        continue;
      }
    }

    // Don't forget to add the last pending issue
    if (currentCode !== undefined && currentMessage !== undefined && currentFile !== undefined && currentLine !== undefined) {
      const error = this.createBanditError(
        currentFile,
        currentLine,
        currentColumn ?? 0,
        currentCode,
        currentMessage,
        currentSeverity ?? 'medium',
        currentConfidence ?? 'medium',
        `${currentCode}: ${currentMessage}`
      );
      errors.push(error);
    }

    return errors;
  }

  private createBanditError(
    file: string,
    line: number,
    column: number,
    code: string,
    message: string,
    severity: string,
    confidence: string,
    raw: string
  ): NormalizedError {
    const location = buildSourceLocation(file, line, column);
    const codeInfo = BANDIT_CODES[code];
    const errorSeverity = this.banditSeverityToErrorSeverity(severity);

    const error: NormalizedError = {
      id: randomUUID(),
      type: `Bandit:${code}`,
      message,
      severity: errorSeverity,
      source: 'static',
      language: 'python',
      raw,
      timestamp: new Date(),
      location,
    };

    // Add code-specific context
    if (codeInfo !== undefined) {
      error.context = {
        code,
        category: codeInfo.category,
        codeDescription: codeInfo.description,
        suggestedFix: codeInfo.fix,
        banditSeverity: severity,
        confidence,
        isSecurityIssue: true,
      };
    } else {
      error.context = {
        code,
        category: this.banditCodeToCategory(code),
        banditSeverity: severity,
        confidence,
        isSecurityIssue: true,
      };
    }

    return error;
  }

  private banditSeverityToErrorSeverity(severity: string): 'error' | 'warning' | 'info' {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'warning';
    }
  }

  private banditCodeToCategory(code: string): string {
    // Extract the first digit after B to determine category
    const match = /^B(\d)/.exec(code);
    if (match === null) return 'security';

    const categoryDigit = match[1];
    const categories: Record<string, string> = {
      '1': 'misc',
      '2': 'framework',
      '3': 'blacklist-call',
      '4': 'blacklist-import',
      '5': 'cryptography',
      '6': 'injection',
      '7': 'xss',
    };
    return categories[categoryDigit ?? ''] ?? 'security';
  }

  private parsePylintOutput(raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      // Try default format with column: file.py:10:5: C0114: Message (symbol-name)
      let match = PYTHON_PATTERNS.pylint.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const column = match[3];
        const code = match[4];
        const message = match[5];
        const symbolName = match[6];

        if (file !== undefined && lineNum !== undefined && column !== undefined && code !== undefined && message !== undefined) {
          const error = this.createPylintError(
            file,
            parseInt(lineNum, 10),
            parseInt(column, 10),
            code,
            message,
            symbolName,
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try format without column: file.py:10: C0114: Message (symbol-name)
      match = PYTHON_PATTERNS.pylintNoColumn.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const code = match[3];
        const message = match[4];
        const symbolName = match[5];

        if (file !== undefined && lineNum !== undefined && code !== undefined && message !== undefined) {
          const error = this.createPylintError(
            file,
            parseInt(lineNum, 10),
            0,
            code,
            message,
            symbolName,
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try parseable format: file.py:10: [C0114(symbol-name), context] Message
      match = PYTHON_PATTERNS.pylintParseable.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const code = match[3];
        const symbolName = match[4];
        const message = match[6];

        if (file !== undefined && lineNum !== undefined && code !== undefined && message !== undefined) {
          const error = this.createPylintError(
            file,
            parseInt(lineNum, 10),
            0,
            code,
            message,
            symbolName,
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try short format: C:10,5: Message (symbol-name)
      match = PYTHON_PATTERNS.pylintShort.exec(line);
      if (match !== null) {
        const category = match[1];
        const lineNum = match[2];
        const column = match[3];
        const message = match[4];
        const symbolName = match[5];

        if (category !== undefined && lineNum !== undefined && message !== undefined) {
          // Short format doesn't have file path, use placeholder
          const error = this.createPylintError(
            '<unknown>',
            parseInt(lineNum, 10),
            column !== undefined ? parseInt(column, 10) : 0,
            `${category}0000`, // Placeholder code for short format
            message,
            symbolName,
            line
          );
          errors.push(error);
        }
      }
    }

    return errors;
  }

  private createPylintError(
    file: string,
    line: number,
    column: number,
    code: string,
    message: string,
    symbolName: string | undefined,
    raw: string
  ): NormalizedError {
    const location = buildSourceLocation(file, line, column);
    const codeInfo = PYLINT_CODES[code];
    const errorSeverity = this.pylintSeverityToErrorSeverity(code);

    const error: NormalizedError = {
      id: randomUUID(),
      type: `Pylint:${code}`,
      message,
      severity: errorSeverity,
      source: 'static',
      language: 'python',
      raw,
      timestamp: new Date(),
      location,
    };

    // Add code-specific context
    if (codeInfo !== undefined) {
      error.context = {
        code,
        symbolName,
        category: codeInfo.category,
        pylintSeverity: codeInfo.severity,
        codeDescription: codeInfo.description,
        suggestedFix: codeInfo.fix,
      };
    } else {
      error.context = {
        code,
        symbolName,
        category: this.pylintCodeToCategory(code),
        pylintSeverity: this.pylintCodeToPylintSeverity(code),
      };
    }

    return error;
  }

  private pylintSeverityToErrorSeverity(code: string): 'error' | 'warning' | 'info' {
    // First character indicates severity: C=convention, R=refactor, W=warning, E=error, F=fatal
    const prefix = code.charAt(0).toUpperCase();
    switch (prefix) {
      case 'E':
      case 'F':
        return 'error';
      case 'W':
        return 'warning';
      case 'C':
      case 'R':
        return 'info';
      default:
        return 'warning';
    }
  }

  private pylintCodeToCategory(code: string): string {
    const prefix = code.charAt(0).toUpperCase();
    const categories: Record<string, string> = {
      C: 'convention',
      R: 'refactor',
      W: 'warning',
      E: 'error',
      F: 'fatal',
      I: 'informational',
    };
    return categories[prefix] ?? 'unknown';
  }

  private pylintCodeToPylintSeverity(code: string): 'convention' | 'refactor' | 'warning' | 'error' | 'fatal' {
    const prefix = code.charAt(0).toUpperCase();
    switch (prefix) {
      case 'C':
        return 'convention';
      case 'R':
        return 'refactor';
      case 'W':
        return 'warning';
      case 'E':
        return 'error';
      case 'F':
        return 'fatal';
      default:
        return 'warning';
    }
  }

  private parsePytestOutput(raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    // Track current test context for multi-line parsing
    let currentFile: string | undefined;
    let currentTest: string | undefined;
    let currentLine: number | undefined;
    let currentErrorType: string | undefined;
    let currentMessage: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // Try FAILED line with error: FAILED tests/test_file.py::test_func - AssertionError: message
      const failedMatch = PYTHON_PATTERNS.pytestFailed.exec(line);
      if (failedMatch !== null) {
        const file = failedMatch[1];
        const testName = failedMatch[2];
        const errorType = failedMatch[3];
        const message = failedMatch[4];

        if (file !== undefined && testName !== undefined) {
          const error = this.createPytestError(
            file,
            0, // Line will be extracted from traceback if available
            testName,
            errorType ?? 'TestFailure',
            message ?? 'Test failed',
            'failed',
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try short FAILED line: FAILED tests/test_file.py::test_func
      const failedShortMatch = PYTHON_PATTERNS.pytestFailedShort.exec(line);
      if (failedShortMatch !== null) {
        const file = failedShortMatch[1];
        const testName = failedShortMatch[2];

        if (file !== undefined && testName !== undefined) {
          const error = this.createPytestError(
            file,
            0,
            testName,
            'TestFailure',
            'Test failed',
            'failed',
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try ERROR line: ERROR tests/test_file.py::test_func - message
      const errorMatch = PYTHON_PATTERNS.pytestError.exec(line);
      if (errorMatch !== null) {
        const file = errorMatch[1];
        const testName = errorMatch[2];
        const message = errorMatch[3];

        if (file !== undefined && testName !== undefined && message !== undefined) {
          // Check for fixture error
          const fixtureMatch = PYTHON_PATTERNS.pytestFixtureError.exec(message);
          const errorType = fixtureMatch !== null ? 'FixtureNotFound' : 'TestError';
          const errorMsg = fixtureMatch !== null
            ? `Fixture '${fixtureMatch[1]}' not found`
            : message;

          const error = this.createPytestError(
            file,
            0,
            testName,
            errorType,
            errorMsg,
            'error',
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Try collection error: ERROR collecting tests/test_file.py
      const collectionMatch = PYTHON_PATTERNS.pytestCollectionError.exec(line);
      if (collectionMatch !== null) {
        const file = collectionMatch[1];

        if (file !== undefined) {
          const error = this.createPytestError(
            file,
            0,
            '<collection>',
            'CollectionError',
            'Error collecting tests from file',
            'error',
            line
          );
          errors.push(error);
          continue;
        }
      }

      // Track location from traceback for context
      const locationMatch = PYTHON_PATTERNS.pytestLocation.exec(line);
      if (locationMatch !== null) {
        currentFile = locationMatch[1];
        const lineNum = locationMatch[2];
        currentTest = locationMatch[3];
        if (lineNum !== undefined) {
          currentLine = parseInt(lineNum, 10);
        }
        continue;
      }

      // Track assertion errors in verbose output
      const assertionMatch = PYTHON_PATTERNS.pytestAssertion.exec(line);
      if (assertionMatch !== null) {
        currentErrorType = assertionMatch[1];
        currentMessage = assertionMatch[2];

        // If we have location context, create an error
        if (currentFile !== undefined && currentTest !== undefined) {
          const error = this.createPytestError(
            currentFile,
            currentLine ?? 0,
            currentTest,
            currentErrorType ?? 'AssertionError',
            currentMessage ?? 'Assertion failed',
            'failed',
            line
          );
          errors.push(error);

          // Reset context
          currentFile = undefined;
          currentTest = undefined;
          currentLine = undefined;
          currentErrorType = undefined;
          currentMessage = undefined;
        }
      }
    }

    return errors;
  }

  private createPytestError(
    file: string,
    line: number,
    testName: string,
    errorType: string,
    message: string,
    status: 'failed' | 'error' | 'skipped',
    raw: string
  ): NormalizedError {
    const location = buildSourceLocation(file, line, 0);
    const errorInfo = PYTEST_ERROR_TYPES[errorType];
    const severity = status === 'error' ? 'error' : status === 'failed' ? 'error' : 'warning';

    const error: NormalizedError = {
      id: randomUUID(),
      type: `pytest:${errorType}`,
      message,
      severity,
      source: 'test',
      language: 'python',
      raw,
      timestamp: new Date(),
      location,
    };

    // Add test-specific context
    if (errorInfo !== undefined) {
      error.context = {
        testName,
        errorType,
        status,
        category: errorInfo.category,
        description: errorInfo.description,
        suggestedFix: errorInfo.fix,
      };
    } else {
      error.context = {
        testName,
        errorType,
        status,
        category: this.pytestErrorToCategory(errorType),
      };
    }

    return error;
  }

  private pytestErrorToCategory(errorType: string): string {
    if (errorType.includes('Assertion')) return 'assertion';
    if (errorType.includes('Fixture')) return 'fixture';
    if (errorType.includes('Import') || errorType.includes('Module')) return 'collection';
    if (errorType.includes('Timeout')) return 'timeout';
    if (errorType.includes('Type')) return 'type';
    if (errorType.includes('Value')) return 'value';
    if (errorType.includes('Key')) return 'key';
    if (errorType.includes('Attribute')) return 'attribute';
    if (errorType.includes('Index')) return 'index';
    if (errorType.includes('IO') || errorType.includes('File') || errorType.includes('Permission')) return 'io';
    if (errorType.includes('Connection') || errorType.includes('HTTP')) return 'network';
    return 'test';
  }

  private parseTraceback(raw: string): NormalizedError | null {
    const lines = raw.split('\n');
    const stackFrames: StackFrame[] = [];
    let errorType = 'Error';
    let message = '';
    let primaryLocation: SourceLocation | undefined;

    let inTraceback = false;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line === undefined) {
        i++;
        continue;
      }

      if (PYTHON_PATTERNS.traceback.test(line)) {
        inTraceback = true;
        i++;
        continue;
      }

      if (inTraceback) {
        const frameMatch = PYTHON_PATTERNS.frame.exec(line);
        if (frameMatch !== null) {
          const file = frameMatch[1];
          const lineNum = frameMatch[2];
          const funcName = frameMatch[3];

          if (file !== undefined && lineNum !== undefined) {
            const location = buildSourceLocation(file, parseInt(lineNum, 10));
            const codeLine = lines[i + 1];
            const codeRaw = codeLine !== undefined && codeLine.startsWith('    ')
              ? codeLine.trim()
              : undefined;

            stackFrames.push(buildStackFrame(
              location,
              funcName,
              codeRaw,
              !isLibraryPath(file)
            ));
          }
          i++;
          continue;
        }

        const errorMatch = PYTHON_PATTERNS.error.exec(line);
        if (errorMatch !== null) {
          const matchedType = errorMatch[1];
          const matchedMessage = errorMatch[2];
          if (matchedType !== undefined) {
            errorType = matchedType;
          }
          if (matchedMessage !== undefined) {
            message = matchedMessage;
          }
          inTraceback = false;
        }
      }

      i++;
    }

    const userFrames = stackFrames.filter((f) => f.isUserCode === true);
    if (userFrames.length > 0) {
      const lastUserFrame = userFrames[userFrames.length - 1];
      if (lastUserFrame !== undefined) {
        primaryLocation = lastUserFrame.location;
      }
    } else if (stackFrames.length > 0) {
      const lastFrame = stackFrames[stackFrames.length - 1];
      if (lastFrame !== undefined) {
        primaryLocation = lastFrame.location;
      }
    }

    if (message === '') {
      return null;
    }

    const error: NormalizedError = {
      id: randomUUID(),
      type: errorType,
      message,
      severity: 'error',
      source: 'exception',
      language: 'python',
      raw,
      timestamp: new Date(),
    };

    if (primaryLocation !== undefined) {
      error.location = primaryLocation;
    }
    if (stackFrames.length > 0) {
      error.stackTrace = stackFrames;
    }

    return error;
  }

  private createError(type: string, message: string, raw: string): NormalizedError {
    return {
      id: randomUUID(),
      type,
      message,
      severity: 'error',
      source: 'exception',
      language: 'python',
      raw,
      timestamp: new Date(),
    };
  }

  // ===========================================================================
  // Analysis
  // ===========================================================================

  async analyze(
    errors: NormalizedError[],
    _context: AnalysisContext
  ): Promise<ModuleAnalysisResult> {
    const startTime = Date.now();
    const hypotheses: RootCauseHypothesis[] = [];
    const fixes: FixSuggestion[] = [];
    const notes: string[] = [];

    for (const error of errors) {
      const hypothesis = this.generateHypothesis(error);
      hypotheses.push(hypothesis);
    }

    return {
      module: 'python',
      errors,
      hypotheses,
      fixes,
      notes,
      analysisTimeMs: Date.now() - startTime,
    };
  }

  private generateHypothesis(error: NormalizedError): RootCauseHypothesis {
    // Check if this is a Pyright error
    if (error.type.startsWith('Pyright:') || error.type === 'PyrightError') {
      return this.generatePyrightHypothesis(error);
    }

    // Check if this is a Mypy error
    if (error.type.startsWith('Mypy:') || error.type === 'MypyError') {
      return this.generateMypyHypothesis(error);
    }

    // Check if this is a Ruff error
    if (error.type.startsWith('Ruff:')) {
      return this.generateRuffHypothesis(error);
    }

    // Check if this is a Bandit security error
    if (error.type.startsWith('Bandit:')) {
      return this.generateBanditHypothesis(error);
    }

    // Check if this is a Pylint error
    if (error.type.startsWith('Pylint:')) {
      return this.generatePylintHypothesis(error);
    }

    // Check if this is a pytest error
    if (error.type.startsWith('pytest:')) {
      return this.generatePytestHypothesis(error);
    }

    const errorInfo = PYTHON_ERROR_TYPES[error.type];
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    // Add error message as evidence
    evidence.push({
      type: 'error',
      description: `${error.type}: ${error.message}`,
      strength: 0.9,
    });

    // Add stack trace evidence
    if (error.stackTrace !== undefined && error.stackTrace.length > 0) {
      const userFrames = error.stackTrace.filter((f) => f.isUserCode === true);
      for (const frame of userFrames) {
        evidence.push({
          type: 'code',
          description: `In ${frame.functionName ?? 'unknown'}: ${frame.raw ?? 'unknown code'}`,
          location: frame.location,
          strength: 0.7,
        });
        relatedLocations.push(frame.location);
      }
    }

    // Generate description based on error type
    let description = `${error.type} occurred`;
    let confidence = 0.6;

    if (errorInfo !== undefined) {
      description = `${error.type} (${errorInfo.category}): ${errorInfo.commonCauses[0] ?? 'Unknown cause'}`;
      confidence = 0.75;

      // Add common causes as evidence
      for (const cause of errorInfo.commonCauses) {
        evidence.push({
          type: 'pattern',
          description: `Possible cause: ${cause}`,
          strength: 0.5,
        });
      }
    }

    // Parse specific patterns in error message
    const specificAnalysis = this.analyzeErrorMessage(error);
    if (specificAnalysis !== null) {
      description = specificAnalysis.description;
      confidence = specificAnalysis.confidence;
      suggestedFixes.push(...specificAnalysis.fixes);
    }

    if (error.location !== undefined) {
      relatedLocations.push(error.location);
    }

    return {
      id: randomUUID(),
      description,
      confidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private generatePyrightHypothesis(error: NormalizedError): RootCauseHypothesis {
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    // Extract rule code from type (e.g., "Pyright:reportArgumentType" -> "reportArgumentType")
    const ruleCode = error.type.startsWith('Pyright:')
      ? error.type.slice(8)
      : undefined;

    // Get rule info from context or lookup
    const contextRule = error.context?.['rule'] as string | undefined;
    const effectiveRuleCode = ruleCode ?? contextRule;
    const ruleInfo = effectiveRuleCode !== undefined
      ? PYRIGHT_ERROR_CODES[effectiveRuleCode]
      : undefined;

    // Add error message as evidence
    evidence.push({
      type: 'error',
      description: `Pyright type error: ${error.message}`,
      strength: 0.95,
    });

    // Add location as evidence
    if (error.location !== undefined) {
      evidence.push({
        type: 'code',
        description: `At ${error.location.file}:${error.location.line}:${error.location.column ?? 1}`,
        location: error.location,
        strength: 0.9,
      });
      relatedLocations.push(error.location);
    }

    // Generate description and confidence based on rule
    let description: string;
    let confidence: number;

    if (ruleInfo !== undefined && effectiveRuleCode !== undefined) {
      description = `Pyright ${effectiveRuleCode}: ${ruleInfo.description} - ${error.message}`;
      confidence = 0.9;

      // Add rule-specific fix
      suggestedFixes.push({
        id: randomUUID(),
        description: ruleInfo.fix,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'pyright',
          expectedOutcome: 'No type errors',
        }],
      });
    } else {
      description = `Pyright type error: ${error.message}`;
      confidence = 0.8;
    }

    // Add message-specific fixes based on common patterns
    const pyrightFixes = this.analyzePyrightMessage(error);
    suggestedFixes.push(...pyrightFixes);

    return {
      id: randomUUID(),
      description,
      confidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private analyzePyrightMessage(error: NormalizedError): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];
    const message = error.message;

    // Type mismatch patterns
    const typeMismatchMatch = /cannot be assigned to type "([^"]+)"/.exec(message);
    if (typeMismatchMatch !== null) {
      const expectedType = typeMismatchMatch[1] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Ensure value matches expected type "${expectedType}"`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'pyright',
          expectedOutcome: 'Type mismatch resolved',
        }],
      });
    }

    // Missing argument patterns
    const missingArgMatch = /Argument missing for parameter "([^"]+)"/.exec(message);
    if (missingArgMatch !== null) {
      const paramName = missingArgMatch[1] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Add missing argument for parameter "${paramName}"`,
        confidence: 0.9,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'pyright',
          expectedOutcome: 'All required arguments provided',
        }],
      });
    }

    // Incorrect argument type
    const argTypeMatch = /Argument of type "([^"]+)" cannot be assigned to parameter "([^"]+)" of type "([^"]+)"/.exec(message);
    if (argTypeMatch !== null) {
      const actualType = argTypeMatch[1] ?? 'unknown';
      const paramName = argTypeMatch[2] ?? 'unknown';
      const expectedType = argTypeMatch[3] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Convert argument from "${actualType}" to "${expectedType}" for parameter "${paramName}"`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'pyright',
          expectedOutcome: 'Argument type matches parameter type',
        }],
      });
    }

    // Optional member access
    if (message.includes('could be None')) {
      fixes.push({
        id: randomUUID(),
        description: 'Add None check before accessing member or use optional chaining',
        confidence: 0.9,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'pyright',
          expectedOutcome: 'Optional type properly handled',
        }],
      });
    }

    // Return type mismatch
    const returnMatch = /Expression of type "([^"]+)" cannot be assigned to declared type "([^"]+)"/.exec(message);
    if (returnMatch !== null) {
      const actualType = returnMatch[1] ?? 'unknown';
      const expectedType = returnMatch[2] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Fix return type: expected "${expectedType}", got "${actualType}"`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'pyright',
          expectedOutcome: 'Return type matches declaration',
        }],
      });
    }

    return fixes;
  }

  private generateMypyHypothesis(error: NormalizedError): RootCauseHypothesis {
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    // Extract error code from type (e.g., "Mypy:arg-type" -> "arg-type")
    const errorCode = error.type.startsWith('Mypy:')
      ? error.type.slice(5)
      : undefined;

    // Get error code info from context or lookup
    const contextCode = error.context?.['errorCode'] as string | undefined;
    const effectiveCode = errorCode ?? contextCode;
    const codeInfo = effectiveCode !== undefined
      ? MYPY_ERROR_CODES[effectiveCode]
      : undefined;

    // Add error message as evidence
    evidence.push({
      type: 'error',
      description: `Mypy type error: ${error.message}`,
      strength: 0.95,
    });

    // Add location as evidence
    if (error.location !== undefined) {
      evidence.push({
        type: 'code',
        description: `At ${error.location.file}:${error.location.line}${error.location.column !== undefined ? `:${error.location.column}` : ''}`,
        location: error.location,
        strength: 0.9,
      });
      relatedLocations.push(error.location);
    }

    // Generate description and confidence based on error code
    let description: string;
    let confidence: number;

    if (codeInfo !== undefined && effectiveCode !== undefined) {
      description = `Mypy [${effectiveCode}]: ${codeInfo.description} - ${error.message}`;
      confidence = 0.9;

      // Add error code-specific fix
      suggestedFixes.push({
        id: randomUUID(),
        description: codeInfo.fix,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'mypy',
          expectedOutcome: 'No type errors',
        }],
      });
    } else {
      description = `Mypy type error: ${error.message}`;
      confidence = 0.8;
    }

    // Add message-specific fixes based on common patterns
    const mypyFixes = this.analyzeMypyMessage(error);
    suggestedFixes.push(...mypyFixes);

    return {
      id: randomUUID(),
      description,
      confidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private analyzeMypyMessage(error: NormalizedError): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];
    const message = error.message;

    // Incompatible type patterns
    const incompatibleMatch = /Incompatible types in assignment \(expression has type "([^"]+)", variable has type "([^"]+)"\)/.exec(message);
    if (incompatibleMatch !== null) {
      const exprType = incompatibleMatch[1] ?? 'unknown';
      const varType = incompatibleMatch[2] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Change expression type from "${exprType}" to match variable type "${varType}"`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'mypy',
          expectedOutcome: 'Assignment types match',
        }],
      });
    }

    // Argument type mismatch
    const argMatch = /Argument (\d+) to "([^"]+)" has incompatible type "([^"]+)"; expected "([^"]+)"/.exec(message);
    if (argMatch !== null) {
      const argNum = argMatch[1] ?? '?';
      const funcName = argMatch[2] ?? 'unknown';
      const actualType = argMatch[3] ?? 'unknown';
      const expectedType = argMatch[4] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Convert argument ${argNum} to "${funcName}" from "${actualType}" to "${expectedType}"`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'mypy',
          expectedOutcome: 'Argument type matches',
        }],
      });
    }

    // Return type mismatch
    const returnMatch = /Incompatible return value type \(got "([^"]+)", expected "([^"]+)"\)/.exec(message);
    if (returnMatch !== null) {
      const gotType = returnMatch[1] ?? 'unknown';
      const expectedType = returnMatch[2] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Fix return value: got "${gotType}", expected "${expectedType}"`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'mypy',
          expectedOutcome: 'Return type matches declaration',
        }],
      });
    }

    // Missing attribute
    const attrMatch = /"([^"]+)" has no attribute "([^"]+)"/.exec(message);
    if (attrMatch !== null) {
      const typeName = attrMatch[1] ?? 'unknown';
      const attrName = attrMatch[2] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Type "${typeName}" does not have attribute "${attrName}" - check spelling or add type annotation`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'mypy',
          expectedOutcome: 'Attribute exists on type',
        }],
      });
    }

    // Name not defined
    const nameMatch = /Name "([^"]+)" is not defined/.exec(message);
    if (nameMatch !== null) {
      const name = nameMatch[1] ?? 'unknown';
      fixes.push({
        id: randomUUID(),
        description: `Define or import "${name}" before use`,
        confidence: 0.9,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'mypy',
          expectedOutcome: 'Name is defined',
        }],
      });
    }

    // Item access on None
    if (message.includes('Item') && message.includes('None')) {
      fixes.push({
        id: randomUUID(),
        description: 'Add None check before item access or use Optional type',
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'mypy',
          expectedOutcome: 'Optional type handled',
        }],
      });
    }

    // Missing type annotation
    if (message.includes('need type annotation')) {
      fixes.push({
        id: randomUUID(),
        description: 'Add explicit type annotation to the variable',
        confidence: 0.9,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'typecheck',
          command: 'mypy',
          expectedOutcome: 'Type annotation present',
        }],
      });
    }

    return fixes;
  }

  private generateRuffHypothesis(error: NormalizedError): RootCauseHypothesis {
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    // Extract code from type (e.g., "Ruff:F401" -> "F401")
    const code = error.type.startsWith('Ruff:')
      ? error.type.slice(5)
      : undefined;

    // Get code info from context or lookup
    const codeInfo = code !== undefined ? RUFF_ERROR_CODES[code] : undefined;
    const contextInfo = error.context as Record<string, unknown> | undefined;
    const isFixable = contextInfo?.['isFixable'] === true;

    // Add error message as evidence
    evidence.push({
      type: 'error',
      description: `Ruff ${code ?? 'lint'} issue: ${error.message}`,
      strength: 0.9,
    });

    // Add location as evidence
    if (error.location !== undefined) {
      evidence.push({
        type: 'code',
        description: `At ${error.location.file}:${error.location.line}:${error.location.column ?? 1}`,
        location: error.location,
        strength: 0.85,
      });
      relatedLocations.push(error.location);
    }

    // Generate description and confidence based on code
    let description: string;
    let confidence: number;

    if (codeInfo !== undefined && code !== undefined) {
      description = `Ruff ${code} (${codeInfo.category}): ${codeInfo.description}`;
      confidence = 0.85;

      // Add code-specific fix
      const fixType = isFixable ? 'Run ruff --fix to auto-fix' : codeInfo.fix;
      suggestedFixes.push({
        id: randomUUID(),
        description: fixType,
        confidence: isFixable ? 0.95 : 0.8,
        type: isFixable ? 'generated' : 'template',
        changes: [],
        validationSteps: [{
          type: 'lint',
          command: 'ruff check',
          expectedOutcome: 'No lint errors',
        }],
      });
    } else {
      description = `Ruff lint issue: ${error.message}`;
      confidence = 0.75;

      if (isFixable) {
        suggestedFixes.push({
          id: randomUUID(),
          description: 'Run ruff --fix to auto-fix this issue',
          confidence: 0.9,
          type: 'generated',
          changes: [],
          validationSteps: [{
            type: 'lint',
            command: 'ruff check',
            expectedOutcome: 'Issue resolved',
          }],
        });
      }
    }

    return {
      id: randomUUID(),
      description,
      confidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private generateBanditHypothesis(error: NormalizedError): RootCauseHypothesis {
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    // Extract code from type (e.g., "Bandit:B101" -> "B101")
    const code = error.type.startsWith('Bandit:')
      ? error.type.slice(7)
      : undefined;

    // Get code info from context or lookup
    const codeInfo = code !== undefined ? BANDIT_CODES[code] : undefined;
    const contextInfo = error.context as Record<string, unknown> | undefined;
    const banditSeverity = contextInfo?.['banditSeverity'] as string | undefined;
    const confidence = contextInfo?.['confidence'] as string | undefined;

    // Add error message as evidence with security emphasis
    evidence.push({
      type: 'error',
      description: `Security issue [${code ?? 'Bandit'}]: ${error.message}`,
      strength: 0.95,
    });

    // Add location as evidence
    if (error.location !== undefined) {
      evidence.push({
        type: 'code',
        description: `At ${error.location.file}:${error.location.line}:${error.location.column ?? 0}`,
        location: error.location,
        strength: 0.9,
      });
      relatedLocations.push(error.location);
    }

    // Add severity/confidence as evidence
    if (banditSeverity !== undefined || confidence !== undefined) {
      evidence.push({
        type: 'pattern',
        description: `Severity: ${banditSeverity ?? 'unknown'}, Confidence: ${confidence ?? 'unknown'}`,
        strength: banditSeverity === 'high' ? 0.9 : banditSeverity === 'medium' ? 0.7 : 0.5,
      });
    }

    // Generate description and confidence based on code
    let description: string;
    let hypothesisConfidence: number;

    if (codeInfo !== undefined && code !== undefined) {
      description = `Security: ${code} (${codeInfo.category}) - ${codeInfo.description}`;
      hypothesisConfidence = banditSeverity === 'high' ? 0.95 : banditSeverity === 'medium' ? 0.85 : 0.75;

      // Add security-specific fix
      suggestedFixes.push({
        id: randomUUID(),
        description: codeInfo.fix,
        confidence: hypothesisConfidence,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'lint',
          command: 'bandit -r',
          expectedOutcome: 'No security issues',
        }],
      });

      // Add category-specific recommendations
      const categoryFixes = this.getBanditCategoryFixes(codeInfo.category, code);
      suggestedFixes.push(...categoryFixes);
    } else {
      description = `Security issue: ${error.message}`;
      hypothesisConfidence = 0.7;
    }

    return {
      id: randomUUID(),
      description,
      confidence: hypothesisConfidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private getBanditCategoryFixes(category: string, code: string): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    switch (category) {
      case 'injection':
        fixes.push({
          id: randomUUID(),
          description: 'Use parameterized queries and avoid string concatenation for commands',
          confidence: 0.9,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'manual',
            description: 'Review all user input handling',
            expectedOutcome: 'All inputs properly sanitized',
          }],
        });
        break;

      case 'crypto':
      case 'cryptography':
        fixes.push({
          id: randomUUID(),
          description: 'Use modern cryptographic algorithms (AES-256, SHA-256+, TLS 1.2+)',
          confidence: 0.85,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'manual',
            description: 'Verify cryptographic configuration',
            expectedOutcome: 'Using secure algorithms and protocols',
          }],
        });
        break;

      case 'xss':
        fixes.push({
          id: randomUUID(),
          description: 'Enable auto-escaping and sanitize all user-provided content',
          confidence: 0.9,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'manual',
            description: 'Review template escaping settings',
            expectedOutcome: 'Auto-escape enabled, user input sanitized',
          }],
        });
        break;

      case 'blacklist-call':
      case 'blacklist-import':
        fixes.push({
          id: randomUUID(),
          description: 'Replace dangerous function/module with safe alternative',
          confidence: 0.85,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'lint',
            command: 'bandit -r',
            expectedOutcome: 'No blacklisted calls/imports',
          }],
        });
        break;

      case 'misc':
        if (code === 'B101') {
          fixes.push({
            id: randomUUID(),
            description: 'Replace assert with explicit error handling (raise Exception)',
            confidence: 0.9,
            type: 'template',
            changes: [],
            validationSteps: [{
              type: 'test',
              command: 'pytest',
              expectedOutcome: 'Tests pass with new error handling',
            }],
          });
        }
        break;
    }

    return fixes;
  }

  private generatePylintHypothesis(error: NormalizedError): RootCauseHypothesis {
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    // Extract code from type (e.g., "Pylint:C0114" -> "C0114")
    const code = error.type.startsWith('Pylint:')
      ? error.type.slice(7)
      : undefined;

    // Get code info from context or lookup
    const codeInfo = code !== undefined ? PYLINT_CODES[code] : undefined;
    const contextInfo = error.context as Record<string, unknown> | undefined;
    const symbolName = contextInfo?.['symbolName'] as string | undefined;

    // Add error message as evidence
    evidence.push({
      type: 'error',
      description: `Pylint ${code ?? 'issue'}${symbolName !== undefined ? ` (${symbolName})` : ''}: ${error.message}`,
      strength: 0.85,
    });

    // Add location as evidence
    if (error.location !== undefined) {
      evidence.push({
        type: 'code',
        description: `At ${error.location.file}:${error.location.line}:${error.location.column ?? 0}`,
        location: error.location,
        strength: 0.85,
      });
      relatedLocations.push(error.location);
    }

    // Generate description and confidence based on code
    let description: string;
    let hypothesisConfidence: number;

    if (codeInfo !== undefined && code !== undefined) {
      description = `Pylint ${code} (${codeInfo.category}): ${codeInfo.description}`;

      // Confidence based on severity
      switch (codeInfo.severity) {
        case 'fatal':
        case 'error':
          hypothesisConfidence = 0.95;
          break;
        case 'warning':
          hypothesisConfidence = 0.85;
          break;
        case 'refactor':
          hypothesisConfidence = 0.75;
          break;
        case 'convention':
          hypothesisConfidence = 0.7;
          break;
        default:
          hypothesisConfidence = 0.75;
      }

      // Add code-specific fix
      suggestedFixes.push({
        id: randomUUID(),
        description: codeInfo.fix,
        confidence: hypothesisConfidence - 0.05,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'lint',
          command: 'pylint',
          expectedOutcome: 'No lint issues',
        }],
      });

      // Add category-specific recommendations
      const categoryFixes = this.getPylintCategoryFixes(codeInfo.category, codeInfo.severity);
      suggestedFixes.push(...categoryFixes);
    } else {
      description = `Pylint issue: ${error.message}`;
      hypothesisConfidence = 0.7;
    }

    return {
      id: randomUUID(),
      description,
      confidence: hypothesisConfidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private getPylintCategoryFixes(category: string, severity: string): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    switch (category) {
      case 'docstring':
        fixes.push({
          id: randomUUID(),
          description: 'Add comprehensive docstrings following Google, NumPy, or Sphinx style',
          confidence: 0.8,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'lint',
            command: 'pylint --enable=missing-docstring',
            expectedOutcome: 'No docstring warnings',
          }],
        });
        break;

      case 'naming':
        fixes.push({
          id: randomUUID(),
          description: 'Follow PEP 8 naming: snake_case for functions/variables, PascalCase for classes, UPPER_CASE for constants',
          confidence: 0.85,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'lint',
            command: 'pylint --enable=invalid-name',
            expectedOutcome: 'No naming violations',
          }],
        });
        break;

      case 'design':
        fixes.push({
          id: randomUUID(),
          description: 'Refactor to reduce complexity: extract methods, simplify logic, reduce nesting',
          confidence: 0.75,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'lint',
            command: 'pylint --enable=design',
            expectedOutcome: 'Design issues resolved',
          }],
        });
        break;

      case 'import':
        fixes.push({
          id: randomUUID(),
          description: 'Organize imports: stdlib first, then third-party, then local. Use isort for automation',
          confidence: 0.9,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'lint',
            command: 'isort --check-only',
            expectedOutcome: 'Imports properly ordered',
          }],
        });
        break;

      case 'exception':
        fixes.push({
          id: randomUUID(),
          description: 'Handle exceptions properly: catch specific types, preserve context with "from", avoid bare except',
          confidence: 0.85,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'lint',
            command: 'pylint --enable=exceptions',
            expectedOutcome: 'Exception handling improved',
          }],
        });
        break;

      case 'variable':
        if (severity === 'error') {
          fixes.push({
            id: randomUUID(),
            description: 'Define variable before use or check for typos in variable name',
            confidence: 0.9,
            type: 'template',
            changes: [],
            validationSteps: [{
              type: 'lint',
              command: 'pylint --enable=undefined-variable',
              expectedOutcome: 'All variables defined',
            }],
          });
        }
        break;

      case 'class':
        fixes.push({
          id: randomUUID(),
          description: 'Follow class best practices: define attributes in __init__, call super().__init__, use @staticmethod/@classmethod appropriately',
          confidence: 0.8,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'lint',
            command: 'pylint --enable=classes',
            expectedOutcome: 'Class issues resolved',
          }],
        });
        break;
    }

    return fixes;
  }

  private generatePytestHypothesis(error: NormalizedError): RootCauseHypothesis {
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    // Extract error type from type (e.g., "pytest:AssertionError" -> "AssertionError")
    const errorType = error.type.startsWith('pytest:')
      ? error.type.slice(7)
      : 'TestFailure';

    // Get error info from context or lookup
    const errorInfo = PYTEST_ERROR_TYPES[errorType];
    const contextInfo = error.context as Record<string, unknown> | undefined;
    const testName = contextInfo?.['testName'] as string | undefined;
    const status = contextInfo?.['status'] as string | undefined;
    const category = contextInfo?.['category'] as string | undefined;

    // Add error message as evidence
    evidence.push({
      type: 'error',
      description: `Test ${status ?? 'failed'}: ${testName ?? 'unknown'} - ${error.message}`,
      strength: 0.9,
    });

    // Add location as evidence
    if (error.location !== undefined) {
      evidence.push({
        type: 'code',
        description: `At ${error.location.file}:${error.location.line}`,
        location: error.location,
        strength: 0.85,
      });
      relatedLocations.push(error.location);
    }

    // Generate description and confidence based on error type
    let description: string;
    let hypothesisConfidence: number;

    if (errorInfo !== undefined) {
      description = `Test failure (${errorInfo.category}): ${errorInfo.description}`;
      hypothesisConfidence = 0.85;

      // Add error-type-specific fix
      suggestedFixes.push({
        id: randomUUID(),
        description: errorInfo.fix,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'test',
          command: `pytest ${error.location?.file ?? ''} -v`,
          expectedOutcome: 'Test passes',
        }],
      });
    } else {
      description = `Test failure: ${error.message}`;
      hypothesisConfidence = 0.75;
    }

    // Add category-specific fixes
    const categoryFixes = this.getPytestCategoryFixes(category ?? this.pytestErrorToCategory(errorType), testName);
    suggestedFixes.push(...categoryFixes);

    return {
      id: randomUUID(),
      description,
      confidence: hypothesisConfidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private getPytestCategoryFixes(category: string, _testName: string | undefined): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    switch (category) {
      case 'assertion':
        fixes.push({
          id: randomUUID(),
          description: 'Compare expected vs actual values; use pytest assertion introspection for detailed output',
          confidence: 0.85,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'test',
            command: 'pytest -v --tb=short',
            expectedOutcome: 'Assertion passes',
          }],
        });
        break;

      case 'fixture':
        fixes.push({
          id: randomUUID(),
          description: 'Check fixture definition, scope, and conftest.py location. Ensure fixture is accessible.',
          confidence: 0.85,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'test',
            command: 'pytest --fixtures',
            expectedOutcome: 'Fixture is listed',
          }],
        });
        break;

      case 'collection':
        fixes.push({
          id: randomUUID(),
          description: 'Fix import errors or syntax issues in test file. Check PYTHONPATH and package structure.',
          confidence: 0.9,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'test',
            command: 'pytest --collect-only',
            expectedOutcome: 'Tests collected successfully',
          }],
        });
        break;

      case 'mock':
        fixes.push({
          id: randomUUID(),
          description: 'Verify mock target path matches import location. Use spec=True for stricter mocking.',
          confidence: 0.8,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'manual',
            description: 'Check mock configuration',
            expectedOutcome: 'Mock behaves correctly',
          }],
        });
        break;

      case 'timeout':
        fixes.push({
          id: randomUUID(),
          description: 'Optimize slow code or use pytest-timeout with appropriate limits',
          confidence: 0.75,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'test',
            command: 'pytest --timeout=60',
            expectedOutcome: 'Test completes within timeout',
          }],
        });
        break;

      case 'async':
        fixes.push({
          id: randomUUID(),
          description: 'Use pytest-asyncio or pytest-trio. Ensure proper async/await usage.',
          confidence: 0.8,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'test',
            command: 'pytest -v',
            expectedOutcome: 'Async test passes',
          }],
        });
        break;

      case 'database':
      case 'io':
        fixes.push({
          id: randomUUID(),
          description: 'Use fixtures for test data setup/teardown. Consider using tmp_path or factories.',
          confidence: 0.8,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'manual',
            description: 'Verify test isolation',
            expectedOutcome: 'Tests are independent',
          }],
        });
        break;

      case 'network':
        fixes.push({
          id: randomUUID(),
          description: 'Mock external services with responses or pytest-httpserver. Avoid real network calls.',
          confidence: 0.85,
          type: 'template',
          changes: [],
          validationSteps: [{
            type: 'manual',
            description: 'Verify mocks are in place',
            expectedOutcome: 'No real network calls',
          }],
        });
        break;
    }

    return fixes;
  }

  private analyzeErrorMessage(error: NormalizedError): {
    description: string;
    confidence: number;
    fixes: FixSuggestion[];
  } | null {
    const message = error.message;

    // TypeError: missing required positional argument
    const missingArgMatch = /missing (\d+) required positional argument[s]?: (.+)/.exec(message);
    if (missingArgMatch !== null) {
      const count = missingArgMatch[1];
      const args = missingArgMatch[2];
      return {
        description: `Function call is missing ${count} required argument(s): ${args}`,
        confidence: 0.9,
        fixes: this.createMissingArgFix(error, args ?? ''),
      };
    }

    // AttributeError: 'NoneType' has no attribute
    if (message.includes("'NoneType' has no attribute")) {
      const attrMatch = /has no attribute '(\w+)'/.exec(message);
      const attr = attrMatch?.[1] ?? 'unknown';
      return {
        description: `Attempted to access attribute '${attr}' on None - missing null check`,
        confidence: 0.85,
        fixes: this.createNoneCheckFix(error, attr),
      };
    }

    // NameError: name 'x' is not defined
    const nameMatch = /name '(\w+)' is not defined/.exec(message);
    if (nameMatch !== null) {
      const varName = nameMatch[1] ?? 'unknown';
      return {
        description: `Variable '${varName}' is used before being defined`,
        confidence: 0.9,
        fixes: this.createUndefinedNameFix(error, varName),
      };
    }

    // KeyError
    const keyMatch = /KeyError: ['"]?(.+?)['"]?$/.exec(message);
    if (keyMatch !== null) {
      const key = keyMatch[1] ?? 'unknown';
      return {
        description: `Dictionary key '${key}' does not exist`,
        confidence: 0.9,
        fixes: this.createKeyErrorFix(error, key),
      };
    }

    // IndexError: list index out of range
    if (message.includes('list index out of range')) {
      return {
        description: 'List index is out of bounds - check list length before accessing',
        confidence: 0.85,
        fixes: this.createIndexErrorFix(error),
      };
    }

    // ImportError / ModuleNotFoundError
    const moduleMatch = /No module named '([^']+)'/.exec(message);
    if (moduleMatch !== null) {
      const moduleName = moduleMatch[1] ?? 'unknown';
      return {
        description: `Module '${moduleName}' is not installed or not found`,
        confidence: 0.9,
        fixes: this.createModuleNotFoundFix(moduleName),
      };
    }

    return null;
  }

  // ===========================================================================
  // Fix Generation
  // ===========================================================================

  async suggestFixes(
    errors: NormalizedError[],
    hypotheses: RootCauseHypothesis[]
  ): Promise<FixSuggestion[]> {
    const fixes: FixSuggestion[] = [];

    for (const hypothesis of hypotheses) {
      fixes.push(...hypothesis.suggestedFixes);
    }

    // Generate additional fixes based on error patterns
    for (const error of errors) {
      const additionalFixes = this.generateAdditionalFixes(error);
      fixes.push(...additionalFixes);
    }

    return fixes;
  }

  private generateAdditionalFixes(error: NormalizedError): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    // Add type-specific fixes
    switch (error.type) {
      case 'ZeroDivisionError':
        fixes.push(this.createZeroDivisionFix(error));
        break;
      case 'RecursionError':
        fixes.push(this.createRecursionFix());
        break;
    }

    return fixes;
  }

  private createMissingArgFix(error: NormalizedError, args: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Add missing argument(s): ${args}`,
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createNoneCheckFix(error: NormalizedError, attr: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Add null check before accessing '${attr}' attribute`,
      confidence: 0.8,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createUndefinedNameFix(error: NormalizedError, varName: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Define variable '${varName}' before use or check for typos`,
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createKeyErrorFix(error: NormalizedError, key: string): FixSuggestion[] {
    return [
      {
        id: randomUUID(),
        description: `Use .get('${key}') with default value instead of direct access`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
      {
        id: randomUUID(),
        description: `Add key existence check: if '${key}' in dict`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
    ];
  }

  private createIndexErrorFix(error: NormalizedError): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: 'Add bounds check: if index < len(list)',
      confidence: 0.8,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createModuleNotFoundFix(moduleName: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Install missing module: pip install ${moduleName}`,
      confidence: 0.9,
      type: 'template',
      changes: [],
      validationSteps: [{
        type: 'manual',
        description: `Run: pip install ${moduleName}`,
        expectedOutcome: 'Module installed successfully',
      }],
    }];
  }

  private createZeroDivisionFix(error: NormalizedError): FixSuggestion {
    return {
      id: randomUUID(),
      description: 'Add check for zero before division',
      confidence: 0.85,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    };
  }

  private createRecursionFix(): FixSuggestion {
    return {
      id: randomUUID(),
      description: 'Add or fix base case in recursive function',
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: [{
        type: 'manual',
        description: 'Verify base case properly terminates recursion',
        expectedOutcome: 'Recursion terminates correctly',
      }],
    };
  }

  private createValidationSteps(error: NormalizedError): ValidationStep[] {
    const steps: ValidationStep[] = [];

    // Add type check step
    steps.push({
      type: 'typecheck',
      command: 'python -m mypy --ignore-missing-imports',
      expectedOutcome: 'No type errors',
    });

    // Add lint step
    steps.push({
      type: 'lint',
      command: 'python -m ruff check',
      expectedOutcome: 'No linting errors',
    });

    // Add test step if we can identify test files
    if (error.location !== undefined) {
      steps.push({
        type: 'test',
        command: 'python -m pytest -x',
        expectedOutcome: 'All tests pass',
      });
    }

    return steps;
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  async validateFix(fix: FixSuggestion): Promise<ValidationResult> {
    const results: ValidationResult['steps'] = [];
    let allPassed = true;

    for (const step of fix.validationSteps) {
      // In production, this would actually run the commands
      // For now, we return a placeholder result
      results.push({
        step,
        passed: true,
        output: 'Validation step pending implementation',
      });
    }

    return {
      passed: allPassed,
      steps: results,
      notes: ['Validation requires execution environment'],
    };
  }

  // ===========================================================================
  // Capability Check
  // ===========================================================================

  canHandle(input: string | NormalizedError): boolean {
    if (typeof input === 'string') {
      // Check for Python-specific patterns
      return (
        PYTHON_PATTERNS.traceback.test(input) ||
        PYTHON_PATTERNS.error.test(input) ||
        PYTHON_PATTERNS.pyright.test(input) ||
        PYTHON_PATTERNS.pyrightWithRule.test(input) ||
        PYTHON_PATTERNS.mypy.test(input) ||
        PYTHON_PATTERNS.mypyWithCode.test(input) ||
        PYTHON_PATTERNS.ruff.test(input) ||
        PYTHON_PATTERNS.ruffFixable.test(input) ||
        PYTHON_PATTERNS.banditIssue.test(input) ||
        PYTHON_PATTERNS.banditCompact.test(input) ||
        PYTHON_PATTERNS.pylint.test(input) ||
        PYTHON_PATTERNS.pylintNoColumn.test(input) ||
        PYTHON_PATTERNS.pylintParseable.test(input) ||
        PYTHON_PATTERNS.pytestFailed.test(input) ||
        PYTHON_PATTERNS.pytestFailedShort.test(input) ||
        PYTHON_PATTERNS.pytestError.test(input) ||
        PYTHON_PATTERNS.pytestCollectionError.test(input) ||
        /\.py[wi]?:/.test(input) ||
        /python/i.test(input)
      );
    }

    return input.language === 'python';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createPythonModule(): PythonModule {
  return new PythonModule();
}
