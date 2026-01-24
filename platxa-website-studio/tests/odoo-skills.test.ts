/**
 * Odoo Skills Comprehensive Tests
 * Tests theme generator, snippet builder, validator, and i18n
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateTheme,
  getIndustryPreset,
  INDUSTRY_PRESETS,
  type ThemeConfig,
} from '../lib/odoo-skills/theme-generator';
import {
  SnippetBuilder,
  getSnippetsByCategory,
  SNIPPET_TEMPLATES,
} from '../lib/odoo-skills/snippet-builder';
import {
  validateTheme,
  validateQWebTemplate,
  validateManifest,
  validateScss,
  validateJavaScript,
} from '../lib/odoo-skills/validator';
import {
  I18nManager,
  SUPPORTED_LANGUAGES,
  extractStringsFromQWeb,
  generatePOFile,
  parsePOFile,
} from '../lib/odoo-skills/i18n';

// =============================================================================
// THEME GENERATOR TESTS
// =============================================================================

describe('Theme Generator', () => {
  describe('Industry Presets', () => {
    it('should have all required industry presets', () => {
      const requiredPresets = [
        'restaurant',
        'technology',
        'legal',
        'healthcare',
        'ecommerce',
        'education',
        'creative',
        'nonprofit',
        'realestate',
        'fitness',
        'generic',
      ];

      requiredPresets.forEach((preset) => {
        expect(INDUSTRY_PRESETS[preset]).toBeDefined();
        expect(INDUSTRY_PRESETS[preset].name).toBeDefined();
        expect(INDUSTRY_PRESETS[preset].colors).toBeDefined();
      });
    });

    it('should return valid preset with getIndustryPreset', () => {
      const preset = getIndustryPreset('restaurant');
      expect(preset).toBeDefined();
      expect(preset?.colors.primary).toBeDefined();
      expect(preset?.typography.headingFamily).toBeDefined();
    });

    it('should return undefined for invalid preset', () => {
      const preset = getIndustryPreset('invalid_preset');
      expect(preset).toBeUndefined();
    });
  });

  describe('Theme Generation', () => {
    let themeConfig: ThemeConfig;

    beforeEach(() => {
      themeConfig = {
        name: 'theme_test',
        displayName: 'Test Theme',
        description: 'A test theme',
        version: '18.0.1.0.0',
        author: 'Test Author',
        website: 'https://example.com',
        license: 'LGPL-3',
        industry: 'technology',
        designStyle: 'modern',
        colors: {
          primary: '#3B82F6',
          secondary: '#10B981',
          accent: '#F59E0B',
          background: '#FFFFFF',
          surface: '#FFFFFF',
          text: '#1F2937',
          textMuted: '#6B7280',
          border: '#E5E7EB',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
        },
        typography: {
          headingFamily: 'Poppins',
          bodyFamily: 'Inter',
          headingWeight: 700,
          bodyWeight: 400,
          baseSize: '16px',
          scale: 1.2,
        },
        features: {
          stickyHeader: true,
          promoBar: false,
          megaMenu: false,
          darkMode: true,
          animations: true,
          lazyLoading: true,
          smoothScroll: true,
          backToTop: true,
          cookieConsent: false,
          socialLinks: true,
        },
        pages: [],
        snippets: [],
      };
    });

    it('should generate complete theme with all required files', () => {
      const theme = generateTheme(themeConfig);

      expect(theme.files).toBeDefined();
      expect(theme.files.length).toBeGreaterThan(0);

      // Check for essential files
      const filePaths = theme.files.map((f) => f.path);
      expect(filePaths.some((p) => p.includes('__manifest__.py'))).toBe(true);
      expect(filePaths.some((p) => p.includes('.scss'))).toBe(true);
      expect(filePaths.some((p) => p.includes('.xml'))).toBe(true);
    });

    it('should generate valid manifest file', () => {
      const theme = generateTheme(themeConfig);
      const manifestFile = theme.files.find((f) => f.path.includes('__manifest__.py'));

      expect(manifestFile).toBeDefined();
      expect(manifestFile?.content).toContain("'name':");
      expect(manifestFile?.content).toContain("'version':");
      expect(manifestFile?.content).toContain("'category': 'Website/Theme'");
    });

    it('should include industry preset colors in SCSS', () => {
      const theme = generateTheme(themeConfig);
      const scssFile = theme.files.find((f) => f.path.includes('primary_variables.scss'));

      expect(scssFile).toBeDefined();
      expect(scssFile?.content).toContain(themeConfig.colors.primary);
    });

    it('should handle feature flags correctly', () => {
      const theme = generateTheme({
        ...themeConfig,
        features: { stickyHeader: true, darkMode: false },
      });

      const files = theme.files.map((f) => f.content).join('\n');
      expect(files).toContain('sticky');
    });
  });
});

// =============================================================================
// SNIPPET BUILDER TESTS
// =============================================================================

describe('Snippet Builder', () => {
  describe('Snippet Templates', () => {
    it('should have snippet templates organized by category', () => {
      const categories = Object.keys(SNIPPET_TEMPLATES);
      expect(categories.length).toBeGreaterThan(0);
      // Check for actual categories in the library
      expect(categories).toContain('structure');
      expect(categories).toContain('content');
    });

    it('should return snippets by category', () => {
      const structureSnippets = getSnippetsByCategory('structure');
      expect(structureSnippets).toBeDefined();
      expect(Array.isArray(structureSnippets)).toBe(true);
    });
  });

  describe('SnippetBuilder Class', () => {
    let builder: SnippetBuilder;

    beforeEach(() => {
      builder = new SnippetBuilder('theme_test');
    });

    it('should create snippet builder with theme name', () => {
      expect(builder).toBeDefined();
    });

    it('should add snippets correctly', () => {
      builder.addSnippet('structure', 's_hero_centered');
      const snippets = builder.getSnippets();
      expect(snippets.length).toBe(1);
    });

    it('should generate valid snippet XML', () => {
      builder.addSnippet('structure', 's_hero_centered');
      const xml = builder.generateSnippetsXml();

      expect(xml).toContain('<template');
      expect(xml).toContain('name=');
    });

    it('should apply options to snippets', () => {
      builder.addSnippet('structure', 's_hero_centered', {
        colorClass: 'o_cc2',
        padding: 'pt48 pb48',
      });

      const snippets = builder.getSnippets();
      expect(snippets[0].options?.colorClass).toBe('o_cc2');
    });

    it('should export snippets configuration', () => {
      builder.addSnippet('structure', 's_hero_centered');
      builder.addSnippet('features', 's_features_grid');

      const config = builder.exportConfig();
      expect(config.snippets.length).toBe(2);
      expect(config.themeName).toBe('theme_test');
    });
  });
});

// =============================================================================
// VALIDATOR TESTS
// =============================================================================

describe('Validator', () => {
  describe('QWeb Template Validation', () => {
    it('should validate correct QWeb template', () => {
      const validTemplate = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
        <template id="test_template" name="Test">
          <t t-call="website.layout">
            <div class="container">
              <t t-foreach="items" t-as="item">
                <span t-esc="item.name"/>
              </t>
            </div>
          </t>
        </template>
</odoo>
      `;

      const issues = validateQWebTemplate(validTemplate, 'test.xml');
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBe(0);
    });

    it('should detect deprecated t-raw usage', () => {
      const deprecatedTemplate = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
        <template id="test">
          <div t-raw="content"/>
        </template>
</odoo>
      `;

      const issues = validateQWebTemplate(deprecatedTemplate, 'test.xml');
      const warnings = issues.filter((i) => i.severity === 'warning');
      expect(warnings.some((w) => w.message.includes('t-raw') || w.message.includes('deprecated'))).toBe(true);
    });

    it('should detect unclosed tags', () => {
      const unclosedTemplate = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
        <template id="test">
          <div>
            <span>Unclosed
          </div>
        </template>
</odoo>
      `;

      const issues = validateQWebTemplate(unclosedTemplate, 'test.xml');
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Manifest Validation', () => {
    it('should validate correct manifest', () => {
      const validManifest = `{
        'name': 'Test Theme',
        'version': '17.0.1.0.0',
        'category': 'Theme',
        'license': 'LGPL-3',
        'depends': ['website'],
        'data': [],
        'assets': {},
      }`;

      const issues = validateManifest(validManifest, '__manifest__.py');
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBe(0);
    });

    it('should detect missing required fields', () => {
      const invalidManifest = `{
        'name': 'Test Theme',
      }`;

      const issues = validateManifest(invalidManifest, '__manifest__.py');
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate version format', () => {
      const badVersionManifest = `{
        'name': 'Test Theme',
        'version': '1.0',
        'category': 'Theme',
        'license': 'LGPL-3',
        'depends': ['website'],
      }`;

      const issues = validateManifest(badVersionManifest, '__manifest__.py');
      const warnings = issues.filter((i) => i.severity === 'warning');
      expect(warnings.some((w) => w.message.toLowerCase().includes('version'))).toBe(true);
    });
  });

  describe('SCSS Validation', () => {
    it('should validate correct SCSS', () => {
      const validScss = `
        $primary: #3B82F6;

        .header {
          background: $primary;

          &__logo {
            display: flex;
          }
        }
      `;

      const issues = validateScss(validScss, 'style.scss');
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBe(0);
    });

    it('should detect mismatched braces', () => {
      const invalidScss = `
        .header {
          background: red;

        .content {
          padding: 20px;
        }
      `;

      const issues = validateScss(invalidScss, 'style.scss');
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should warn about excessive !important usage', () => {
      const importantScss = `
        .header {
          color: red !important;
          background: blue !important;
          padding: 10px !important;
          margin: 5px !important;
          border: 1px solid black !important;
          margin-top: 5px !important;
        }
      `;

      const issues = validateScss(importantScss, 'style.scss');
      const warnings = issues.filter((i) => i.severity === 'warning');
      expect(warnings.some((w) => w.message.includes('!important'))).toBe(true);
    });
  });

  describe('JavaScript Validation', () => {
    it('should validate correct Odoo JS module', () => {
      const validJs = `
        odoo.define('theme_test.main', function (require) {
          'use strict';

          const publicWidget = require('web.public.widget');

          publicWidget.registry.TestWidget = publicWidget.Widget.extend({
            selector: '.test-widget',
            start: function () {
              return this._super.apply(this, arguments);
            },
          });
        });
      `;

      const issues = validateJavaScript(validJs, 'theme.js');
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBe(0);
    });

    it('should warn about console statements', () => {
      const jsWithConsole = `
        odoo.define('theme_test.debug', function (require) {
          console.log('Debug message');
        });
      `;

      const issues = validateJavaScript(jsWithConsole, 'theme.js');
      const infos = issues.filter((i) => i.severity === 'info');
      expect(infos.some((w) => w.message.includes('console') || w.message.includes('Console'))).toBe(true);
    });
  });

  describe('Full Theme Validation', () => {
    it('should validate complete theme structure', () => {
      const themeFiles = [
        {
          path: 'theme_test/__manifest__.py',
          content: `{
            'name': 'Test Theme',
            'version': '17.0.1.0.0',
            'category': 'Theme',
            'license': 'LGPL-3',
            'depends': ['website'],
          }`,
          type: 'py' as const,
        },
        {
          path: 'theme_test/__init__.py',
          content: '# Theme module',
          type: 'py' as const,
        },
        {
          path: 'theme_test/static/src/scss/primary_variables.scss',
          content: '$primary: #3B82F6;',
          type: 'scss' as const,
        },
        {
          path: 'theme_test/views/templates.xml',
          content: '<?xml version="1.0" encoding="utf-8"?><odoo><template id="test"><div>Content</div></template></odoo>',
          type: 'xml' as const,
        },
      ];

      const result = validateTheme(themeFiles);
      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// I18N TESTS
// =============================================================================

describe('I18n System', () => {
  describe('Supported Languages', () => {
    it('should have comprehensive language support', () => {
      expect(Object.keys(SUPPORTED_LANGUAGES).length).toBeGreaterThanOrEqual(20);
      expect(SUPPORTED_LANGUAGES['en_US']).toBeDefined();
      expect(SUPPORTED_LANGUAGES['es_ES']).toBeDefined();
      expect(SUPPORTED_LANGUAGES['fr_FR']).toBeDefined();
    });

    it('should have RTL languages properly configured', () => {
      const arabicConfig = SUPPORTED_LANGUAGES['ar_SA'];
      expect(arabicConfig).toBeDefined();
      expect(arabicConfig?.rtl).toBe(true);

      const hebrewConfig = SUPPORTED_LANGUAGES['he_IL'];
      expect(hebrewConfig).toBeDefined();
      expect(hebrewConfig?.rtl).toBe(true);
    });

    it('should have language metadata', () => {
      const english = SUPPORTED_LANGUAGES['en_US'];
      expect(english?.name).toBeDefined();
      expect(english?.nativeName).toBeDefined();
    });
  });

  describe('I18nManager', () => {
    let i18n: I18nManager;

    beforeEach(() => {
      i18n = new I18nManager('theme_test');
    });

    it('should create manager with theme name', () => {
      expect(i18n).toBeDefined();
    });

    it('should add translations', () => {
      i18n.addTranslation('en_US', 'Hello', 'Hello');
      i18n.addTranslation('es_ES', 'Hello', 'Hola');

      const stats = i18n.getStats();
      expect(stats.languages.length).toBe(2);
    });

    it('should get translation for language', () => {
      i18n.addTranslation('es_ES', 'Hello', 'Hola');
      const translation = i18n.getTranslation('es_ES', 'Hello');
      expect(translation).toBe('Hola');
    });

    it('should return original string if no translation', () => {
      const translation = i18n.getTranslation('es_ES', 'Unknown');
      expect(translation).toBe('Unknown');
    });

    it('should export PO files', () => {
      i18n.addTranslation('es_ES', 'Hello', 'Hola');
      i18n.addTranslation('es_ES', 'Goodbye', 'Adiós');

      const poFiles = i18n.exportPOFiles();
      expect(poFiles.length).toBeGreaterThan(0);
      expect(poFiles[0].language).toBe('es_ES');
    });
  });

  describe('String Extraction', () => {
    it('should extract strings from QWeb templates', () => {
      const template = `
        <template id="test">
          <h1>Welcome to our site</h1>
          <p>Contact us today</p>
          <button>Submit</button>
        </template>
      `;

      const strings = extractStringsFromQWeb(template);
      expect(strings.length).toBeGreaterThan(0);
      expect(strings).toContain('Welcome to our site');
    });

    it('should ignore empty strings', () => {
      const template = `
        <template id="test">
          <div>   </div>
          <span></span>
        </template>
      `;

      const strings = extractStringsFromQWeb(template);
      expect(strings.every((s) => s.trim().length > 0)).toBe(true);
    });
  });

  describe('PO File Generation', () => {
    it('should generate valid PO file format', () => {
      const translations = new Map([
        ['Hello', 'Hola'],
        ['Goodbye', 'Adiós'],
      ]);

      const poContent = generatePOFile('es_ES', 'theme_test', translations);

      expect(poContent).toContain('msgid "Hello"');
      expect(poContent).toContain('msgstr "Hola"');
      expect(poContent).toContain('Language: es_ES');
    });

    it('should handle special characters', () => {
      const translations = new Map([
        ['Say "Hello"', 'Di "Hola"'],
        ["It's working", 'Está funcionando'],
      ]);

      const poContent = generatePOFile('es_ES', 'theme_test', translations);
      expect(poContent).toBeDefined();
    });
  });

  describe('PO File Parsing', () => {
    it('should parse valid PO file', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es_ES\\n"

msgid "Hello"
msgstr "Hola"

msgid "Goodbye"
msgstr "Adiós"
      `;

      const translations = parsePOFile(poContent);
      expect(translations.get('Hello')).toBe('Hola');
      expect(translations.get('Goodbye')).toBe('Adiós');
    });
  });
});
