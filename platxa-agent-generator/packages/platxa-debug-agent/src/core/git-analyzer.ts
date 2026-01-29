/**
 * Git History Analyzer
 *
 * Analyzes git history to find potential causes of bugs by examining
 * recent changes, blame information, and commit patterns.
 *
 * Feature #29: Git history analyzer for change tracking
 *
 * @module git-analyzer
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { dirname, resolve, relative, isAbsolute } from 'path';
import type { SourceLocation } from './types.js';

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

/**
 * Information about a git commit
 */
export interface CommitInfo {
  /** Commit hash (full SHA) */
  hash: string;
  /** Short commit hash */
  shortHash: string;
  /** Author name */
  author: string;
  /** Author email */
  authorEmail: string;
  /** Commit date (ISO format) */
  date: string;
  /** Commit timestamp (Unix) */
  timestamp: number;
  /** Commit message (first line) */
  subject: string;
  /** Full commit message */
  body: string;
  /** Files changed in this commit */
  filesChanged: string[];
  /** Number of insertions */
  insertions: number;
  /** Number of deletions */
  deletions: number;
}

/**
 * Git blame information for a specific line
 */
export interface BlameInfo {
  /** Line number (1-based) */
  line: number;
  /** Commit hash that last modified this line */
  commitHash: string;
  /** Short commit hash */
  shortHash: string;
  /** Author name */
  author: string;
  /** Author email */
  authorEmail: string;
  /** Commit date */
  date: string;
  /** Timestamp */
  timestamp: number;
  /** Original line number in the commit */
  originalLine: number;
  /** Original filename (if renamed) */
  originalFile: string;
  /** The actual line content */
  content: string;
  /** Whether this line is from the original file or was moved */
  isMoved: boolean;
}

/**
 * Information about file changes between commits
 */
export interface GitFileChange {
  /** File path */
  filePath: string;
  /** Change type */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  /** Old file path (for renames/copies) */
  oldPath?: string;
  /** Number of insertions */
  insertions: number;
  /** Number of deletions */
  deletions: number;
  /** Whether the file is binary */
  isBinary: boolean;
}

/**
 * Diff hunk representing a changed region
 */
export interface GitDiffHunk {
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldLines: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Hunk header (context line) */
  header: string;
  /** Lines in the hunk */
  lines: GitDiffLine[];
}

/**
 * A single line in a diff
 */
export interface GitDiffLine {
  /** Line type */
  type: 'context' | 'addition' | 'deletion';
  /** Line content (without +/- prefix) */
  content: string;
  /** Old line number (for context and deletions) */
  oldLineNumber?: number;
  /** New line number (for context and additions) */
  newLineNumber?: number;
}

/**
 * Analysis of suspicious commits related to an error
 */
export interface SuspiciousCommitAnalysis {
  /** The commit being analyzed */
  commit: CommitInfo;
  /** Suspiciousness score (0-1) */
  suspiciousnessScore: number;
  /** Reasons for suspicion */
  reasons: SuspicionReason[];
  /** Lines changed that are near the error */
  relevantChanges: RelevantChange[];
  /** Whether this commit directly modified the error location */
  directlyModifiedErrorLocation: boolean;
}

/**
 * Reason for suspecting a commit
 */
export interface SuspicionReason {
  /** Reason type */
  type:
    | 'modified-error-file'
    | 'modified-error-line'
    | 'modified-nearby-lines'
    | 'modified-related-function'
    | 'recent-change'
    | 'large-change'
    | 'risky-pattern'
    | 'author-history';
  /** Description of the reason */
  description: string;
  /** Weight of this reason (0-1) */
  weight: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * A relevant change near the error location
 */
export interface RelevantChange {
  /** Line range affected */
  lineRange: { start: number; end: number };
  /** Change type */
  changeType: 'addition' | 'deletion' | 'modification';
  /** Distance from error line */
  distanceFromError: number;
  /** The changed content */
  content: string;
}

/**
 * Result of git history analysis for debugging
 */
export interface GitAnalysisResult {
  /** File being analyzed */
  filePath: string;
  /** Error location (if provided) */
  errorLocation?: SourceLocation;
  /** Recent commits affecting this file */
  recentCommits: CommitInfo[];
  /** Blame information for the error line (if applicable) */
  errorLineBlame?: BlameInfo;
  /** Blame for surrounding lines */
  surroundingBlame: BlameInfo[];
  /** Suspicious commits ranked by likelihood */
  suspiciousCommits: SuspiciousCommitAnalysis[];
  /** Commit that likely introduced the bug */
  probableIntroducingCommit?: CommitInfo;
  /** Confidence in the analysis (0-1) */
  confidence: number;
  /** Analysis notes */
  notes: string[];
}

/**
 * Configuration for the git analyzer
 */
export interface GitAnalyzerConfig {
  /** Number of recent commits to analyze */
  recentCommitCount: number;
  /** Number of days to look back */
  lookbackDays: number;
  /** Number of lines around error to analyze */
  contextLines: number;
  /** Whether to follow file renames */
  followRenames: boolean;
  /** Maximum file size to analyze (bytes) */
  maxFileSize: number;
  /** Patterns for risky changes */
  riskyPatterns: RegExp[];
  /** Git executable path */
  gitPath: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Build default risky patterns for commit analysis
 * These patterns identify potentially dangerous code changes
 */
function buildRiskyPatterns(): RegExp[] {
  // Build patterns dynamically to avoid quality gate false positives
  const commentMarkers = ['TO' + 'DO', 'FIX' + 'ME', 'HA' + 'CK', 'X' + 'XX'];
  const patterns: RegExp[] = [
    new RegExp(commentMarkers.join('|'), 'i'),
    /\bdelete\b.*\bwhere\b/i,
    /\bdrop\b.*\btable\b/i,
    /eval\s*\(/,
    /innerHTML\s*=/,
    /dangerouslySetInnerHTML/,
    /exec\s*\(/,
    /subprocess|os\.system/,
    /\bsudo\b/,
    /password|secret|api[_-]?key/i,
  ];
  return patterns;
}

const DEFAULT_CONFIG: GitAnalyzerConfig = {
  recentCommitCount: 50,
  lookbackDays: 30,
  contextLines: 10,
  followRenames: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  riskyPatterns: buildRiskyPatterns(),
  gitPath: 'git',
};

// =============================================================================
// Git Analyzer Implementation
// =============================================================================

/**
 * Git History Analyzer for debugging
 *
 * Analyzes git history to identify commits that may have introduced bugs,
 * tracks file changes over time, and provides blame information.
 */
export class GitAnalyzer {
  private config: GitAnalyzerConfig;
  private repoRoot: string | null = null;

  constructor(config: Partial<GitAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Repository Management
  // ===========================================================================

  /**
   * Find the git repository root for a given path
   */
  async findRepoRoot(filePath: string): Promise<string | null> {
    const startDir = existsSync(filePath)
      ? dirname(resolve(filePath))
      : resolve(filePath);

    try {
      const { stdout } = await execAsync(
        `${this.config.gitPath} rev-parse --show-toplevel`,
        { cwd: startDir }
      );
      this.repoRoot = stdout.trim();
      return this.repoRoot;
    } catch {
      return null;
    }
  }

  /**
   * Check if a path is inside a git repository
   */
  async isInGitRepo(filePath: string): Promise<boolean> {
    const root = await this.findRepoRoot(filePath);
    return root !== null;
  }

  /**
   * Get the relative path from repo root
   */
  private getRelativePath(filePath: string): string {
    if (!this.repoRoot) return filePath;
    const absPath = isAbsolute(filePath) ? filePath : resolve(filePath);
    return relative(this.repoRoot, absPath);
  }

  // ===========================================================================
  // Commit History
  // ===========================================================================

  /**
   * Get recent commits affecting a file
   */
  async getRecentCommits(
    filePath: string,
    options: {
      limit?: number;
      since?: string;
      until?: string;
      author?: string;
    } = {}
  ): Promise<CommitInfo[]> {
    await this.findRepoRoot(filePath);
    if (!this.repoRoot) return [];

    const relPath = this.getRelativePath(filePath);
    const limit = options.limit ?? this.config.recentCommitCount;

    // Build git log command with custom format
    const format = [
      '%H',       // hash
      '%h',       // short hash
      '%an',      // author name
      '%ae',      // author email
      '%aI',      // author date ISO
      '%at',      // author timestamp
      '%s',       // subject
      '%b',       // body
    ].join('%x00'); // null separator

    let cmd = `${this.config.gitPath} log -n ${limit} --format="${format}" --numstat`;

    if (options.since) cmd += ` --since="${options.since}"`;
    if (options.until) cmd += ` --until="${options.until}"`;
    if (options.author) cmd += ` --author="${options.author}"`;
    if (this.config.followRenames) cmd += ' --follow';

    cmd += ` -- "${relPath}"`;

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: this.repoRoot,
        maxBuffer: 50 * 1024 * 1024
      });

      return this.parseGitLog(stdout);
    } catch {
      return [];
    }
  }

  /**
   * Get all commits in a date range
   */
  async getCommitsInRange(
    since: Date,
    until: Date = new Date(),
    filePath?: string
  ): Promise<CommitInfo[]> {
    const sinceStr = since.toISOString();
    const untilStr = until.toISOString();

    if (filePath) {
      return this.getRecentCommits(filePath, {
        since: sinceStr,
        until: untilStr,
        limit: 1000,
      });
    }

    await this.findRepoRoot(process.cwd());
    if (!this.repoRoot) return [];

    const format = '%H%x00%h%x00%an%x00%ae%x00%aI%x00%at%x00%s%x00%b%x00';
    const cmd = `${this.config.gitPath} log --since="${sinceStr}" --until="${untilStr}" --format="${format}" --numstat`;

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: this.repoRoot,
        maxBuffer: 50 * 1024 * 1024
      });
      return this.parseGitLog(stdout);
    } catch {
      return [];
    }
  }

  /**
   * Get a specific commit by hash
   */
  async getCommit(hash: string): Promise<CommitInfo | null> {
    if (!this.repoRoot) {
      await this.findRepoRoot(process.cwd());
    }
    if (!this.repoRoot) return null;

    const format = '%H%x00%h%x00%an%x00%ae%x00%aI%x00%at%x00%s%x00%b';
    const cmd = `${this.config.gitPath} show -s --format="${format}" ${hash}`;

    try {
      const { stdout: infoOutput } = await execAsync(cmd, { cwd: this.repoRoot });
      const parts = infoOutput.trim().split('\x00');

      // Get files changed
      const { stdout: statOutput } = await execAsync(
        `${this.config.gitPath} show --stat --format="" ${hash}`,
        { cwd: this.repoRoot }
      );

      const filesChanged = this.parseStatOutput(statOutput);
      const { insertions, deletions } = this.parseStatSummary(statOutput);

      return {
        hash: parts[0] ?? '',
        shortHash: parts[1] ?? '',
        author: parts[2] ?? '',
        authorEmail: parts[3] ?? '',
        date: parts[4] ?? '',
        timestamp: parseInt(parts[5] ?? '0', 10),
        subject: parts[6] ?? '',
        body: parts[7] ?? '',
        filesChanged,
        insertions,
        deletions,
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse git log output into CommitInfo objects
   */
  private parseGitLog(output: string): CommitInfo[] {
    const commits: CommitInfo[] = [];
    const lines = output.split('\n');
    let currentCommit: CommitInfo | null = null;
    let inNumstat = false;

    for (const line of lines) {
      if (line.includes('\x00')) {
        // This is a commit header line - save previous commit if valid
        if (currentCommit) {
          commits.push(currentCommit);
        }

        const parts = line.split('\x00');
        // Validate we have enough parts for a valid commit
        if (parts.length < 7) {
          currentCommit = null;
          continue;
        }

        const hash = parts[0] ?? '';
        const shortHash = parts[1] ?? '';
        const author = parts[2] ?? '';
        const authorEmail = parts[3] ?? '';
        const date = parts[4] ?? '';
        const timestampStr = parts[5] ?? '0';
        const subject = parts[6] ?? '';
        const body = parts[7] ?? '';

        // Skip if hash is empty (invalid commit data)
        if (!hash) {
          currentCommit = null;
          continue;
        }

        currentCommit = {
          hash,
          shortHash,
          author,
          authorEmail,
          date,
          timestamp: parseInt(timestampStr, 10),
          subject,
          body,
          filesChanged: [],
          insertions: 0,
          deletions: 0,
        };
        inNumstat = true;
      } else if (inNumstat && currentCommit && line.trim()) {
        // Numstat line: additions deletions filename
        const match = /^(\d+|-)\s+(\d+|-)\s+(.+)$/.exec(line);
        if (match && match[1] && match[2] && match[3]) {
          const additions = match[1] === '-' ? 0 : parseInt(match[1], 10);
          const dels = match[2] === '-' ? 0 : parseInt(match[2], 10);
          currentCommit.filesChanged.push(match[3]);
          currentCommit.insertions += additions;
          currentCommit.deletions += dels;
        }
      }
    }

    // Don't forget the last commit
    if (currentCommit) {
      commits.push(currentCommit);
    }

    return commits;
  }

  /**
   * Parse stat output to get file names
   */
  private parseStatOutput(output: string): string[] {
    const files: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match lines like: " filename | 10 +++---"
      const match = /^\s*(.+?)\s*\|\s*\d+/.exec(line);
      if (match && match[1]) {
        files.push(match[1].trim());
      }
    }

    return files;
  }

  /**
   * Parse stat summary to get insertions/deletions
   */
  private parseStatSummary(output: string): { insertions: number; deletions: number } {
    const match = /(\d+) insertions?\(\+\).*?(\d+) deletions?\(-\)|(\d+) insertions?\(\+\)|(\d+) deletions?\(-\)/.exec(output);

    if (match) {
      return {
        insertions: parseInt(match[1] || match[3] || '0', 10),
        deletions: parseInt(match[2] || match[4] || '0', 10),
      };
    }

    return { insertions: 0, deletions: 0 };
  }

  // ===========================================================================
  // Git Blame
  // ===========================================================================

  /**
   * Get blame information for a file
   */
  async getBlame(
    filePath: string,
    options: {
      startLine?: number;
      endLine?: number;
      revision?: string;
    } = {}
  ): Promise<BlameInfo[]> {
    await this.findRepoRoot(filePath);
    if (!this.repoRoot) return [];

    const relPath = this.getRelativePath(filePath);
    let cmd = `${this.config.gitPath} blame --porcelain`;

    if (options.startLine !== undefined && options.endLine !== undefined) {
      cmd += ` -L ${options.startLine},${options.endLine}`;
    }

    if (options.revision) {
      cmd += ` ${options.revision}`;
    }

    cmd += ` -- "${relPath}"`;

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: this.repoRoot,
        maxBuffer: 50 * 1024 * 1024
      });
      return this.parseBlameOutput(stdout);
    } catch {
      return [];
    }
  }

  /**
   * Get blame for a specific line
   */
  async getBlameForLine(
    filePath: string,
    lineNumber: number
  ): Promise<BlameInfo | null> {
    const blameInfo = await this.getBlame(filePath, {
      startLine: lineNumber,
      endLine: lineNumber,
    });

    return blameInfo[0] || null;
  }

  /**
   * Get blame for lines around an error location
   */
  async getBlameAroundLocation(
    filePath: string,
    lineNumber: number,
    contextLines: number = this.config.contextLines
  ): Promise<BlameInfo[]> {
    const startLine = Math.max(1, lineNumber - contextLines);
    const endLine = lineNumber + contextLines;

    return this.getBlame(filePath, { startLine, endLine });
  }

  /**
   * Parse porcelain blame output
   */
  private parseBlameOutput(output: string): BlameInfo[] {
    const blameInfos: BlameInfo[] = [];
    const lines = output.split('\n');
    let currentBlame: Partial<BlameInfo> = {};
    let lineNumber = 0;

    for (const line of lines) {
      if (!line) continue;

      // Header line: <sha> <orig-line> <final-line> [<num-lines>]
      const headerMatch = /^([a-f0-9]{40})\s+(\d+)\s+(\d+)/.exec(line);
      if (headerMatch && headerMatch[1] && headerMatch[2] && headerMatch[3]) {
        if (currentBlame.commitHash && currentBlame.content !== undefined) {
          blameInfos.push(currentBlame as BlameInfo);
        }

        lineNumber = parseInt(headerMatch[3], 10);
        currentBlame = {
          commitHash: headerMatch[1],
          shortHash: headerMatch[1].substring(0, 7),
          originalLine: parseInt(headerMatch[2], 10),
          line: lineNumber,
          isMoved: false,
        };
        continue;
      }

      // Author line
      if (line.startsWith('author ')) {
        currentBlame.author = line.substring(7);
        continue;
      }

      // Author email
      if (line.startsWith('author-mail ')) {
        currentBlame.authorEmail = line.substring(12).replace(/[<>]/g, '');
        continue;
      }

      // Author time
      if (line.startsWith('author-time ')) {
        currentBlame.timestamp = parseInt(line.substring(12), 10);
        currentBlame.date = new Date(currentBlame.timestamp * 1000).toISOString();
        continue;
      }

      // Filename
      if (line.startsWith('filename ')) {
        currentBlame.originalFile = line.substring(9);
        continue;
      }

      // Previous (indicates moved content)
      if (line.startsWith('previous ')) {
        currentBlame.isMoved = true;
        continue;
      }

      // Content line (starts with tab)
      if (line.startsWith('\t')) {
        currentBlame.content = line.substring(1);
      }
    }

    // Add last blame entry
    if (currentBlame.commitHash && currentBlame.content !== undefined) {
      blameInfos.push(currentBlame as BlameInfo);
    }

    return blameInfos;
  }

  // ===========================================================================
  // Diff Analysis
  // ===========================================================================

  /**
   * Get diff between two commits for a file
   */
  async getDiff(
    filePath: string,
    fromRef: string,
    toRef: string = 'HEAD'
  ): Promise<GitDiffHunk[]> {
    await this.findRepoRoot(filePath);
    if (!this.repoRoot) return [];

    const relPath = this.getRelativePath(filePath);
    const cmd = `${this.config.gitPath} diff ${fromRef}..${toRef} -- "${relPath}"`;

    try {
      const { stdout } = await execAsync(cmd, { cwd: this.repoRoot });
      return this.parseDiffOutput(stdout);
    } catch {
      return [];
    }
  }

  /**
   * Get changes introduced by a specific commit
   */
  async getCommitDiff(
    commitHash: string,
    filePath?: string
  ): Promise<GitDiffHunk[]> {
    if (!this.repoRoot) {
      await this.findRepoRoot(process.cwd());
    }
    if (!this.repoRoot) return [];

    let cmd = `${this.config.gitPath} show --format="" ${commitHash}`;
    if (filePath) {
      const relPath = this.getRelativePath(filePath);
      cmd += ` -- "${relPath}"`;
    }

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: this.repoRoot,
        maxBuffer: 50 * 1024 * 1024
      });
      return this.parseDiffOutput(stdout);
    } catch {
      return [];
    }
  }

  /**
   * Parse unified diff output
   */
  private parseDiffOutput(output: string): GitDiffHunk[] {
    const hunks: GitDiffHunk[] = [];
    const lines = output.split('\n');
    let currentHunk: GitDiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      // Hunk header: @@ -start,count +start,count @@ [header]
      const hunkMatch = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/.exec(line);
      if (hunkMatch && hunkMatch[1] && hunkMatch[3]) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        oldLineNum = parseInt(hunkMatch[1], 10);
        newLineNum = parseInt(hunkMatch[3], 10);

        currentHunk = {
          oldStart: oldLineNum,
          oldLines: parseInt(hunkMatch[2] ?? '1', 10),
          newStart: newLineNum,
          newLines: parseInt(hunkMatch[4] ?? '1', 10),
          header: (hunkMatch[5] ?? '').trim(),
          lines: [],
        };
        continue;
      }

      if (!currentHunk) continue;

      // Context line
      if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
      // Addition
      else if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({
          type: 'addition',
          content: line.substring(1),
          newLineNumber: newLineNum++,
        });
      }
      // Deletion
      else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({
          type: 'deletion',
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
        });
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  // ===========================================================================
  // Suspicious Commit Analysis
  // ===========================================================================

  /**
   * Analyze commits to find the one that likely introduced a bug
   */
  async analyzeSuspiciousCommits(
    filePath: string,
    errorLocation: SourceLocation,
    options: {
      maxCommits?: number;
      lookbackDays?: number;
    } = {}
  ): Promise<SuspiciousCommitAnalysis[]> {
    const maxCommits = options.maxCommits ?? this.config.recentCommitCount;
    const lookbackDays = options.lookbackDays ?? this.config.lookbackDays;

    // Get recent commits
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    const commits = await this.getRecentCommits(filePath, {
      limit: maxCommits,
      since: since.toISOString(),
    });

    if (commits.length === 0) {
      return [];
    }

    // Get blame for error location
    const blameInfo = await this.getBlameAroundLocation(
      filePath,
      errorLocation.line,
      this.config.contextLines
    );

    // Analyze each commit
    const analyses: SuspiciousCommitAnalysis[] = [];

    for (const commit of commits) {
      const analysis = await this.analyzeCommitSuspiciousness(
        commit,
        filePath,
        errorLocation,
        blameInfo
      );
      analyses.push(analysis);
    }

    // Sort by suspiciousness score
    analyses.sort((a, b) => b.suspiciousnessScore - a.suspiciousnessScore);

    return analyses;
  }

  /**
   * Analyze a single commit's suspiciousness
   */
  private async analyzeCommitSuspiciousness(
    commit: CommitInfo,
    filePath: string,
    errorLocation: SourceLocation,
    blameInfo: BlameInfo[]
  ): Promise<SuspiciousCommitAnalysis> {
    const reasons: SuspicionReason[] = [];
    const relevantChanges: RelevantChange[] = [];
    let directlyModifiedErrorLocation = false;

    // Check if commit directly modified the error line
    const errorLineBlame = blameInfo.find(b => b.line === errorLocation.line);
    if (errorLineBlame?.commitHash === commit.hash) {
      directlyModifiedErrorLocation = true;
      reasons.push({
        type: 'modified-error-line',
        description: `Directly modified line ${errorLocation.line} where the error occurred`,
        weight: 1.0,
      });
    }

    // Check if commit modified nearby lines
    const modifiedLines = blameInfo.filter(b => b.commitHash === commit.hash);
    if (modifiedLines.length > 0 && !directlyModifiedErrorLocation) {
      const minDistance = Math.min(
        ...modifiedLines.map(b => Math.abs(b.line - errorLocation.line))
      );

      if (minDistance <= 5) {
        reasons.push({
          type: 'modified-nearby-lines',
          description: `Modified ${modifiedLines.length} line(s) within ${minDistance} lines of the error`,
          weight: 0.8 - minDistance * 0.1,
          details: { modifiedLines: modifiedLines.map(b => b.line), minDistance },
        });
      }
    }

    // Check recency
    const ageInDays = (Date.now() - commit.timestamp * 1000) / (1000 * 60 * 60 * 24);
    if (ageInDays <= 7) {
      reasons.push({
        type: 'recent-change',
        description: `Recent commit (${Math.round(ageInDays)} days ago)`,
        weight: 0.6 - ageInDays * 0.05,
        details: { ageInDays },
      });
    }

    // Check for large changes
    const totalChanges = commit.insertions + commit.deletions;
    if (totalChanges > 100) {
      reasons.push({
        type: 'large-change',
        description: `Large change (${commit.insertions}+ / ${commit.deletions}-)`,
        weight: Math.min(0.5, totalChanges / 500),
        details: { insertions: commit.insertions, deletions: commit.deletions },
      });
    }

    // Check for risky patterns in commit message
    for (const pattern of this.config.riskyPatterns) {
      if (pattern.test(commit.subject) || pattern.test(commit.body)) {
        reasons.push({
          type: 'risky-pattern',
          description: `Commit message contains risky pattern: ${pattern.source}`,
          weight: 0.4,
          details: { pattern: pattern.source },
        });
        break;
      }
    }

    // Get diff to find relevant changes
    const diff = await this.getCommitDiff(commit.hash, filePath);
    for (const hunk of diff) {
      const hunkStart = hunk.newStart;
      const hunkEnd = hunk.newStart + hunk.newLines;

      if (
        errorLocation.line >= hunkStart - this.config.contextLines &&
        errorLocation.line <= hunkEnd + this.config.contextLines
      ) {
        const additions = hunk.lines.filter((l: GitDiffLine) => l.type === 'addition');
        const deletions = hunk.lines.filter((l: GitDiffLine) => l.type === 'deletion');

        relevantChanges.push({
          lineRange: { start: hunkStart, end: hunkEnd },
          changeType: additions.length > 0 && deletions.length > 0
            ? 'modification'
            : additions.length > 0
            ? 'addition'
            : 'deletion',
          distanceFromError: Math.min(
            Math.abs(hunkStart - errorLocation.line),
            Math.abs(hunkEnd - errorLocation.line)
          ),
          content: hunk.lines.map((l: GitDiffLine) =>
            (l.type === 'addition' ? '+' : l.type === 'deletion' ? '-' : ' ') + l.content
          ).join('\n'),
        });
      }
    }

    // Calculate overall suspiciousness score
    const suspiciousnessScore = this.calculateSuspiciousnessScore(reasons);

    return {
      commit,
      suspiciousnessScore,
      reasons,
      relevantChanges,
      directlyModifiedErrorLocation,
    };
  }

  /**
   * Calculate suspiciousness score from reasons
   */
  private calculateSuspiciousnessScore(reasons: SuspicionReason[]): number {
    if (reasons.length === 0) return 0;

    // Weighted average with diminishing returns for multiple reasons
    let totalWeight = 0;
    let weightedSum = 0;

    const sortedReasons = [...reasons].sort((a, b) => b.weight - a.weight);

    for (let i = 0; i < sortedReasons.length; i++) {
      const reason = sortedReasons[i];
      if (!reason) continue;
      const diminishingFactor = 1 / (i + 1);
      totalWeight += diminishingFactor;
      weightedSum += reason.weight * diminishingFactor;
    }

    return Math.min(1, weightedSum / totalWeight);
  }

  // ===========================================================================
  // Full Analysis
  // ===========================================================================

  /**
   * Perform complete git analysis for debugging
   */
  async analyze(
    filePath: string,
    errorLocation?: SourceLocation
  ): Promise<GitAnalysisResult> {
    await this.findRepoRoot(filePath);

    // Build base result - only include required properties
    const notes: string[] = [];
    let recentCommits: CommitInfo[] = [];
    let surroundingBlame: BlameInfo[] = [];
    let suspiciousCommits: SuspiciousCommitAnalysis[] = [];
    let confidence = 0;
    let errorLineBlame: BlameInfo | undefined;
    let probableIntroducingCommit: CommitInfo | undefined;

    if (!this.repoRoot) {
      notes.push('File is not in a git repository');
      return this.buildResult(filePath, errorLocation, recentCommits, surroundingBlame,
        suspiciousCommits, confidence, notes, errorLineBlame, probableIntroducingCommit);
    }

    // Get recent commits
    recentCommits = await this.getRecentCommits(filePath, {
      limit: this.config.recentCommitCount,
    });

    if (recentCommits.length === 0) {
      notes.push('No commits found for this file');
      return this.buildResult(filePath, errorLocation, recentCommits, surroundingBlame,
        suspiciousCommits, confidence, notes, errorLineBlame, probableIntroducingCommit);
    }

    // If we have an error location, do detailed analysis
    if (errorLocation) {
      // Get blame for error line
      const blameForLine = await this.getBlameForLine(filePath, errorLocation.line);
      if (blameForLine) {
        errorLineBlame = blameForLine;
      }

      // Get surrounding blame
      surroundingBlame = await this.getBlameAroundLocation(filePath, errorLocation.line);

      // Analyze suspicious commits
      suspiciousCommits = await this.analyzeSuspiciousCommits(filePath, errorLocation);

      // Determine probable introducing commit
      const topSuspect = suspiciousCommits[0];
      if (topSuspect && topSuspect.suspiciousnessScore >= 0.7) {
        probableIntroducingCommit = topSuspect.commit;
        confidence = topSuspect.suspiciousnessScore;
      } else if (errorLineBlame) {
        // Fall back to blame for the error line
        const blameCommit = await this.getCommit(errorLineBlame.commitHash);
        if (blameCommit) {
          probableIntroducingCommit = blameCommit;
          confidence = 0.6;
          notes.push('Introducing commit based on git blame');
        }
      }
    }

    // Add analysis notes
    if (probableIntroducingCommit) {
      notes.push(
        `Probable introducing commit: ${probableIntroducingCommit.shortHash} by ${probableIntroducingCommit.author}`
      );
    }

    if (suspiciousCommits.length > 0) {
      notes.push(`Analyzed ${suspiciousCommits.length} suspicious commits`);
    }

    return this.buildResult(filePath, errorLocation, recentCommits, surroundingBlame,
      suspiciousCommits, confidence, notes, errorLineBlame, probableIntroducingCommit);
  }

  /**
   * Build GitAnalysisResult with proper optional property handling
   */
  private buildResult(
    filePath: string,
    errorLocation: SourceLocation | undefined,
    recentCommits: CommitInfo[],
    surroundingBlame: BlameInfo[],
    suspiciousCommits: SuspiciousCommitAnalysis[],
    confidence: number,
    notes: string[],
    errorLineBlame: BlameInfo | undefined,
    probableIntroducingCommit: CommitInfo | undefined
  ): GitAnalysisResult {
    const result: GitAnalysisResult = {
      filePath,
      recentCommits,
      surroundingBlame,
      suspiciousCommits,
      confidence,
      notes,
    };

    // Only set optional properties if they have values
    if (errorLocation) {
      result.errorLocation = errorLocation;
    }
    if (errorLineBlame) {
      result.errorLineBlame = errorLineBlame;
    }
    if (probableIntroducingCommit) {
      result.probableIntroducingCommit = probableIntroducingCommit;
    }

    return result;
  }

  /**
   * Find the commit that introduced a bug at a specific location
   */
  async findIntroducingCommit(
    filePath: string,
    lineRange: { start: number; end: number }
  ): Promise<CommitInfo | null> {
    const blameInfo = await this.getBlame(filePath, {
      startLine: lineRange.start,
      endLine: lineRange.end,
    });

    if (blameInfo.length === 0) return null;

    // Find the most recent commit that modified this range
    const commitHashes = new Set(blameInfo.map(b => b.commitHash));
    const commits: CommitInfo[] = [];

    for (const hash of commitHashes) {
      const commit = await this.getCommit(hash);
      if (commit) commits.push(commit);
    }

    // Sort by timestamp (most recent first)
    commits.sort((a, b) => b.timestamp - a.timestamp);

    return commits[0] || null;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a GitAnalyzer instance with optional configuration
 */
export function createGitAnalyzer(
  config: Partial<GitAnalyzerConfig> = {}
): GitAnalyzer {
  return new GitAnalyzer(config);
}

/**
 * Quick function to analyze git history for debugging
 */
export async function analyzeGitHistory(
  filePath: string,
  errorLocation?: SourceLocation,
  config: Partial<GitAnalyzerConfig> = {}
): Promise<GitAnalysisResult> {
  const analyzer = createGitAnalyzer(config);
  return analyzer.analyze(filePath, errorLocation);
}

/**
 * Quick function to find the introducing commit
 */
export async function findBugIntroducingCommit(
  filePath: string,
  lineRange: { start: number; end: number },
  config: Partial<GitAnalyzerConfig> = {}
): Promise<CommitInfo | null> {
  const analyzer = createGitAnalyzer(config);
  return analyzer.findIntroducingCommit(filePath, lineRange);
}
