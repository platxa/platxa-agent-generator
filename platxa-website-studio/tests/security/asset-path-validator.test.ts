/**
 * Tests for Asset Path Validator - Path Traversal Detection
 */

import { describe, it, expect } from 'vitest';
import {
  validateAssetPath,
  validateAssetPaths,
  hasPathTraversal,
  sanitizePath,
  resolveAssetPath,
  validateOdooAssetPath,
  validateQWebAssetExpression,
  validateAssetUrlsInContent,
  validateThemeAssets,
  formatValidationReport,
  type PathValidationResult,
} from '../../lib/security/asset-path-validator';

describe('Asset Path Validator', () => {
  describe('validateAssetPath', () => {
    describe('safe paths', () => {
      it('accepts valid relative paths', () => {
        const result = validateAssetPath('static/src/img/logo.png');
        expect(result.valid).toBe(true);
        expect(result.severity).toBe('safe');
        expect(result.issues).toHaveLength(0);
      });

      it('accepts valid nested paths', () => {
        const result = validateAssetPath('theme_name/static/src/scss/styles.scss');
        expect(result.valid).toBe(true);
      });

      it('accepts paths with hyphens and underscores', () => {
        const result = validateAssetPath('my-theme_v2/static/src/img/hero-bg_large.webp');
        expect(result.valid).toBe(true);
      });
    });

    describe('dot-dot-slash detection', () => {
      it('detects simple ../ traversal', () => {
        const result = validateAssetPath('../etc/passwd');
        expect(result.valid).toBe(false);
        expect(result.severity).toBe('blocked');
        expect(result.issues.some(i => i.type === 'dot-dot-slash')).toBe(true);
      });

      it('detects chained traversal', () => {
        const result = validateAssetPath('../../../../../../etc/passwd');
        expect(result.valid).toBe(false);
        expect(result.issues.filter(i => i.type === 'dot-dot-slash').length).toBeGreaterThan(0);
      });

      it('detects mid-path traversal', () => {
        const result = validateAssetPath('static/src/../../../config.py');
        expect(result.valid).toBe(false);
      });

      it('detects traversal with backslash', () => {
        const result = validateAssetPath('..\\windows\\system32');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.type === 'dot-dot-backslash')).toBe(true);
      });
    });

    describe('URL-encoded traversal detection', () => {
      it('detects %2e%2e%2f encoding', () => {
        const result = validateAssetPath('%2e%2e%2fetc/passwd');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.type === 'encoded-traversal')).toBe(true);
      });

      it('detects mixed encoding (..%2f)', () => {
        const result = validateAssetPath('..%2f..%2fetc/passwd');
        expect(result.valid).toBe(false);
      });

      it('detects partial encoding (%2e./)', () => {
        const result = validateAssetPath('%2e%2e/secret');
        expect(result.valid).toBe(false);
      });

      it('detects double-encoded traversal', () => {
        const result = validateAssetPath('%252e%252e%252fetc/passwd');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.type === 'double-encoded')).toBe(true);
      });
    });

    describe('null byte detection', () => {
      it('detects null byte injection', () => {
        const result = validateAssetPath('image.png%00.txt');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.type === 'null-byte')).toBe(true);
      });

      it('detects null byte in path', () => {
        const result = validateAssetPath('static/src%00/../config.py');
        expect(result.valid).toBe(false);
      });
    });

    describe('absolute path detection', () => {
      it('detects Unix absolute paths to sensitive directories', () => {
        const result = validateAssetPath('/etc/passwd');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.type === 'absolute-path')).toBe(true);
      });

      it('detects /var paths', () => {
        const result = validateAssetPath('/var/log/syslog');
        expect(result.valid).toBe(false);
      });

      it('detects Windows absolute paths', () => {
        const result = validateAssetPath('C:\\Windows\\System32\\config');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.type === 'absolute-path')).toBe(true);
      });
    });

    describe('protocol handler detection', () => {
      it('detects file:// protocol', () => {
        const result = validateAssetPath('file:///etc/passwd');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.type === 'protocol-handler')).toBe(true);
      });

      it('detects php:// wrapper', () => {
        const result = validateAssetPath('php://filter/convert.base64-encode/resource=index.php');
        expect(result.valid).toBe(false);
      });

      it('detects data: protocol', () => {
        const result = validateAssetPath('data:text/html,<script>alert(1)</script>');
        expect(result.valid).toBe(false);
      });

      it('allows http:// and https://', () => {
        // These should not be blocked by protocol detection
        // They may fail other checks but not protocol-handler
        const result = validateAssetPath('https://cdn.example.com/image.png');
        expect(result.issues.some(i => i.type === 'protocol-handler')).toBe(false);
      });
    });

    describe('unicode/UTF-8 evasion detection', () => {
      it('detects overlong UTF-8 dot encoding', () => {
        const result = validateAssetPath('%c0%ae%c0%ae/etc/passwd');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.type === 'unicode-traversal')).toBe(true);
      });

      it('detects overlong UTF-8 slash encoding', () => {
        const result = validateAssetPath('..%c0%afetc/passwd');
        expect(result.valid).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('handles empty string', () => {
        const result = validateAssetPath('');
        expect(result.valid).toBe(false);
      });

      it('handles null/undefined gracefully', () => {
        const result = validateAssetPath(null as unknown as string);
        expect(result.valid).toBe(false);
      });

      it('handles single dot correctly', () => {
        const result = validateAssetPath('./image.png');
        expect(result.valid).toBe(true); // ./ is safe
      });

      it('provides sanitized path on failure', () => {
        const result = validateAssetPath('../../../etc/passwd');
        expect(result.valid).toBe(false);
        expect(result.sanitizedPath).toBeDefined();
        expect(result.sanitizedPath).not.toContain('../');
      });

      it('provides recommendation on failure', () => {
        const result = validateAssetPath('../secret');
        expect(result.valid).toBe(false);
        expect(result.recommendation).toBeDefined();
        expect(result.recommendation!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('hasPathTraversal', () => {
    it('returns true for paths with traversal', () => {
      expect(hasPathTraversal('../secret')).toBe(true);
      expect(hasPathTraversal('..\\secret')).toBe(true);
      expect(hasPathTraversal('%2e%2e%2f')).toBe(true);
    });

    it('returns false for safe paths', () => {
      expect(hasPathTraversal('static/img/logo.png')).toBe(false);
      expect(hasPathTraversal('./current/file.txt')).toBe(false);
    });

    it('returns false for empty/null paths', () => {
      expect(hasPathTraversal('')).toBe(false);
      expect(hasPathTraversal(null as unknown as string)).toBe(false);
    });
  });

  describe('sanitizePath', () => {
    it('removes ../ sequences', () => {
      expect(sanitizePath('../../../etc/passwd')).toBe('etc/passwd');
    });

    it('removes multiple chained traversals', () => {
      expect(sanitizePath('a/../b/../c/../d')).toBe('a/b/c/d');
    });

    it('normalizes backslashes to forward slashes', () => {
      expect(sanitizePath('static\\src\\img')).toBe('static/src/img');
    });

    it('removes null bytes', () => {
      expect(sanitizePath('file.png%00.txt')).toBe('file.png.txt');
    });

    it('removes leading slashes', () => {
      expect(sanitizePath('/static/src/img')).toBe('static/src/img');
    });

    it('collapses multiple slashes', () => {
      expect(sanitizePath('static//src///img')).toBe('static/src/img');
    });

    it('removes protocol handlers', () => {
      expect(sanitizePath('file:///etc/passwd')).toBe('etc/passwd');
    });

    it('handles empty string', () => {
      expect(sanitizePath('')).toBe('');
    });
  });

  describe('resolveAssetPath', () => {
    it('resolves valid relative paths', () => {
      const result = resolveAssetPath('/module/static', 'src/img/logo.png');
      expect(result).toBe('module/static/src/img/logo.png');
    });

    it('returns null for traversal attempts', () => {
      const result = resolveAssetPath('/module/static', '../../../etc/passwd');
      expect(result).toBeNull();
    });

    it('handles paths with leading slashes', () => {
      const result = resolveAssetPath('/module/static/', '/src/img/logo.png');
      expect(result).toBe('module/static/src/img/logo.png');
    });

    it('returns null for encoded traversal', () => {
      const result = resolveAssetPath('/module/static', '%2e%2e%2f%2e%2e%2f');
      expect(result).toBeNull();
    });
  });

  describe('validateOdooAssetPath', () => {
    it('accepts valid Odoo static paths', () => {
      const result = validateOdooAssetPath('/theme_test/static/src/img/logo.png');
      expect(result.valid).toBe(true);
    });

    it('accepts web module paths', () => {
      const result = validateOdooAssetPath('/web/static/lib/jquery/jquery.js');
      expect(result.valid).toBe(true);
    });

    it('accepts website module paths', () => {
      const result = validateOdooAssetPath('/website/static/src/scss/website.scss');
      expect(result.valid).toBe(true);
    });

    it('accepts /web/image/ paths', () => {
      const result = validateOdooAssetPath('/web/image/123/image_256');
      expect(result.valid).toBe(true);
    });

    it('accepts https:// URLs', () => {
      const result = validateOdooAssetPath('https://cdn.example.com/image.png');
      expect(result.valid).toBe(true);
    });

    it('rejects non-Odoo paths', () => {
      const result = validateOdooAssetPath('/random/path/file.png');
      expect(result.valid).toBe(false);
    });

    it('still blocks traversal in Odoo paths', () => {
      const result = validateOdooAssetPath('/theme_test/static/../../../etc/passwd');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateQWebAssetExpression', () => {
    it('accepts static path expressions', () => {
      const result = validateQWebAssetExpression("'/theme/static/src/img/logo.png'");
      expect(result.valid).toBe(true);
    });

    it('warns about dynamic paths with user input', () => {
      const result = validateQWebAssetExpression("'/static/img/' + request.params.filename");
      expect(result.valid).toBe(false);
      expect(result.severity).toBe('warning');
    });

    it('detects traversal in literal path segments', () => {
      const result = validateQWebAssetExpression("'../../../' + 'secret.txt'");
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAssetUrlsInContent', () => {
    it('finds traversal in src attributes', () => {
      const content = '<img src="../../../etc/passwd" />';
      const results = validateAssetUrlsInContent(content);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].valid).toBe(false);
    });

    it('finds traversal in href attributes', () => {
      const content = '<link href="../../secret.css" rel="stylesheet" />';
      const results = validateAssetUrlsInContent(content);
      expect(results.length).toBeGreaterThan(0);
    });

    it('finds traversal in url() functions', () => {
      const content = 'background: url("../../../config.png");';
      const results = validateAssetUrlsInContent(content);
      expect(results.length).toBeGreaterThan(0);
    });

    it('finds traversal in t-att-src attributes', () => {
      const content = '<img t-att-src="\'../../../secret.png\'" />';
      const results = validateAssetUrlsInContent(content);
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array for safe content', () => {
      const content = '<img src="/theme/static/src/img/logo.png" />';
      const results = validateAssetUrlsInContent(content);
      expect(results.length).toBe(0);
    });
  });

  describe('validateAssetPaths', () => {
    it('validates multiple paths', () => {
      const paths = [
        'static/src/img/logo.png',
        '../../../etc/passwd',
        'theme/static/src/scss/main.scss',
      ];

      const results = validateAssetPaths(paths);

      expect(results.size).toBe(3);
      expect(results.get('static/src/img/logo.png')?.valid).toBe(true);
      expect(results.get('../../../etc/passwd')?.valid).toBe(false);
      expect(results.get('theme/static/src/scss/main.scss')?.valid).toBe(true);
    });
  });

  describe('validateThemeAssets', () => {
    it('generates validation report', () => {
      const paths = [
        'static/src/img/logo.png',
        'static/src/img/hero.jpg',
        '../../../etc/passwd',
        '%2e%2e%2fsecret',
      ];

      const report = validateThemeAssets(paths);

      expect(report.totalPaths).toBe(4);
      expect(report.validPaths).toBe(2);
      expect(report.blockedPaths).toBe(2);
      expect(report.passed).toBe(false);
      expect(report.issues.length).toBe(2);
    });

    it('passes for all valid paths', () => {
      const paths = [
        'static/src/img/logo.png',
        'static/src/scss/main.scss',
        'static/description/icon.png',
      ];

      const report = validateThemeAssets(paths);

      expect(report.passed).toBe(true);
      expect(report.blockedPaths).toBe(0);
    });
  });

  describe('formatValidationReport', () => {
    it('formats report with issues', () => {
      const report = validateThemeAssets([
        '../../../etc/passwd',
        'valid/path.png',
      ]);

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('Asset Path Validation Report');
      expect(formatted).toContain('FAILED');
      expect(formatted).toContain('Blocked: 1');
      expect(formatted).toContain('../../../etc/passwd');
    });

    it('formats passing report', () => {
      const report = validateThemeAssets(['valid/path.png']);

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('PASSED');
      expect(formatted).toContain('Blocked: 0');
    });
  });
});
