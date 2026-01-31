/**
 * Tests for Error Filtering and Search
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addError,
  addErrors,
  removeError,
  clearErrors,
  getError,
  getAllErrors,
  getErrorCount,
  setFilter,
  getFilter,
  resetFilter,
  clearFilterField,
  filterBySeverity,
  filterBySeverities,
  addSeverityFilter,
  removeSeverityFilter,
  toggleSeverityFilter,
  filterByCategory,
  filterByCategories,
  addCategoryFilter,
  removeCategoryFilter,
  toggleCategoryFilter,
  filterByFile,
  filterByFiles,
  addFileFilter,
  removeFileFilter,
  search,
  clearSearch,
  getSearchQuery,
  filterByTimeRange,
  filterFromTimestamp,
  filterToTimestamp,
  clearTimeFilter,
  filterByCode,
  filterByCodes,
  addCodeFilter,
  removeCodeFilter,
  getFilteredErrors,
  getFilteredCount,
  getFilterResult,
  hasActiveFilter,
  getFilterSummary,
  getUniqueFiles,
  getUniqueCodes,
  getUniqueSources,
  showErrorsOnly,
  showWarningsOnly,
  showErrorsAndWarnings,
  showAll,
  getState,
  resetErrorFilter,
  getAllSeverities,
  getAllCategories,
  createError,
  type FilterableError,
} from '../../lib/agent-bridge/error-filter';

describe('Error Filtering and Search', () => {
  beforeEach(() => {
    resetErrorFilter();
  });

  describe('Error Management', () => {
    describe('addError', () => {
      it('should add an error', () => {
        const error = createError('e1', 'Test error');
        addError(error);

        expect(getError('e1')).toEqual(error);
        expect(getErrorCount()).toBe(1);
      });

      it('should index error for search', () => {
        const error = createError('e1', 'Cannot find module');
        addError(error);

        search('module');
        expect(getFilteredCount()).toBe(1);
      });
    });

    describe('addErrors', () => {
      it('should add multiple errors', () => {
        const errors = [
          createError('e1', 'Error 1'),
          createError('e2', 'Error 2'),
          createError('e3', 'Error 3'),
        ];
        addErrors(errors);

        expect(getErrorCount()).toBe(3);
      });
    });

    describe('removeError', () => {
      it('should remove an error', () => {
        const error = createError('e1', 'Test error');
        addError(error);

        expect(removeError('e1')).toBe(true);
        expect(getError('e1')).toBeNull();
        expect(getErrorCount()).toBe(0);
      });

      it('should return false for unknown error', () => {
        expect(removeError('unknown')).toBe(false);
      });
    });

    describe('clearErrors', () => {
      it('should clear all errors', () => {
        addError(createError('e1', 'Error 1'));
        addError(createError('e2', 'Error 2'));

        clearErrors();

        expect(getErrorCount()).toBe(0);
        expect(getFilteredCount()).toBe(0);
      });
    });

    describe('getAllErrors', () => {
      it('should return errors sorted by timestamp', () => {
        addError(createError('e1', 'Error 1', { timestamp: 1000 }));
        addError(createError('e2', 'Error 2', { timestamp: 3000 }));
        addError(createError('e3', 'Error 3', { timestamp: 2000 }));

        const all = getAllErrors();

        expect(all[0].id).toBe('e2');
        expect(all[1].id).toBe('e3');
        expect(all[2].id).toBe('e1');
      });
    });
  });

  describe('Severity Filtering', () => {
    beforeEach(() => {
      addError(createError('e1', 'Error 1', { severity: 'error' }));
      addError(createError('e2', 'Warning 1', { severity: 'warning' }));
      addError(createError('e3', 'Info 1', { severity: 'info' }));
      addError(createError('e4', 'Error 2', { severity: 'error' }));
    });

    describe('filterBySeverity', () => {
      it('should filter by single severity', () => {
        filterBySeverity('error');

        expect(getFilteredCount()).toBe(2);
        expect(getFilteredErrors().every(e => e.severity === 'error')).toBe(true);
      });
    });

    describe('filterBySeverities', () => {
      it('should filter by multiple severities', () => {
        filterBySeverities(['error', 'warning']);

        expect(getFilteredCount()).toBe(3);
      });
    });

    describe('addSeverityFilter', () => {
      it('should add severity to filter', () => {
        filterBySeverity('error');
        addSeverityFilter('warning');

        expect(getFilteredCount()).toBe(3);
      });

      it('should not duplicate severity', () => {
        filterBySeverity('error');
        addSeverityFilter('error');

        expect(getFilter().severities.length).toBe(1);
      });
    });

    describe('removeSeverityFilter', () => {
      it('should remove severity from filter', () => {
        filterBySeverities(['error', 'warning']);
        removeSeverityFilter('warning');

        expect(getFilteredCount()).toBe(2);
        expect(getFilter().severities).toEqual(['error']);
      });
    });

    describe('toggleSeverityFilter', () => {
      it('should toggle severity on', () => {
        toggleSeverityFilter('error');

        expect(getFilter().severities).toContain('error');
      });

      it('should toggle severity off', () => {
        filterBySeverity('error');
        toggleSeverityFilter('error');

        expect(getFilter().severities).not.toContain('error');
      });
    });
  });

  describe('Category Filtering', () => {
    beforeEach(() => {
      addError(createError('e1', 'Syntax error', { category: 'syntax' }));
      addError(createError('e2', 'Type error', { category: 'type' }));
      addError(createError('e3', 'Runtime error', { category: 'runtime' }));
      addError(createError('e4', 'Another type error', { category: 'type' }));
    });

    describe('filterByCategory', () => {
      it('should filter by single category', () => {
        filterByCategory('type');

        expect(getFilteredCount()).toBe(2);
        expect(getFilteredErrors().every(e => e.category === 'type')).toBe(true);
      });
    });

    describe('filterByCategories', () => {
      it('should filter by multiple categories', () => {
        filterByCategories(['syntax', 'type']);

        expect(getFilteredCount()).toBe(3);
      });
    });

    describe('addCategoryFilter', () => {
      it('should add category to filter', () => {
        filterByCategory('syntax');
        addCategoryFilter('type');

        expect(getFilteredCount()).toBe(3);
      });

      it('should not duplicate category', () => {
        filterByCategory('syntax');
        addCategoryFilter('syntax');

        expect(getFilter().categories.length).toBe(1);
      });
    });

    describe('removeCategoryFilter', () => {
      it('should remove category from filter', () => {
        filterByCategories(['syntax', 'type']);
        removeCategoryFilter('type');

        expect(getFilteredCount()).toBe(1);
      });
    });

    describe('toggleCategoryFilter', () => {
      it('should toggle category on', () => {
        toggleCategoryFilter('syntax');

        expect(getFilter().categories).toContain('syntax');
      });

      it('should toggle category off', () => {
        filterByCategory('syntax');
        toggleCategoryFilter('syntax');

        expect(getFilter().categories).not.toContain('syntax');
      });
    });
  });

  describe('File Filtering', () => {
    beforeEach(() => {
      addError(createError('e1', 'Error in app.ts', { file: 'src/app.ts' }));
      addError(createError('e2', 'Error in main.ts', { file: 'src/main.ts' }));
      addError(createError('e3', 'Another app error', { file: 'src/app.ts' }));
      addError(createError('e4', 'No file error', { file: null }));
    });

    describe('filterByFile', () => {
      it('should filter by single file', () => {
        filterByFile('src/app.ts');

        expect(getFilteredCount()).toBe(2);
        expect(getFilteredErrors().every(e => e.file === 'src/app.ts')).toBe(true);
      });
    });

    describe('filterByFiles', () => {
      it('should filter by multiple files', () => {
        filterByFiles(['src/app.ts', 'src/main.ts']);

        expect(getFilteredCount()).toBe(3);
      });
    });

    describe('addFileFilter', () => {
      it('should add file to filter', () => {
        filterByFile('src/app.ts');
        addFileFilter('src/main.ts');

        expect(getFilteredCount()).toBe(3);
      });

      it('should not duplicate file', () => {
        filterByFile('src/app.ts');
        addFileFilter('src/app.ts');

        expect(getFilter().files.length).toBe(1);
      });
    });

    describe('removeFileFilter', () => {
      it('should remove file from filter', () => {
        filterByFiles(['src/app.ts', 'src/main.ts']);
        removeFileFilter('src/main.ts');

        expect(getFilteredCount()).toBe(2);
      });
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      addError(createError('e1', 'Cannot find module express'));
      addError(createError('e2', 'TypeError: undefined is not a function'));
      addError(createError('e3', 'Module not found: react'));
      addError(createError('e4', 'Syntax error in file'));
    });

    describe('search', () => {
      it('should search by message content', () => {
        search('module');

        expect(getFilteredCount()).toBe(2);
      });

      it('should be case insensitive', () => {
        search('MODULE');

        expect(getFilteredCount()).toBe(2);
      });

      it('should match partial words', () => {
        search('func');

        expect(getFilteredCount()).toBe(1);
      });

      it('should match multiple terms', () => {
        search('module express');

        expect(getFilteredCount()).toBe(1);
      });
    });

    describe('clearSearch', () => {
      it('should clear search query', () => {
        search('module');
        clearSearch();

        expect(getSearchQuery()).toBe('');
        expect(getFilteredCount()).toBe(4);
      });
    });

    describe('getSearchQuery', () => {
      it('should return current search query', () => {
        search('test query');

        expect(getSearchQuery()).toBe('test query');
      });
    });

    it('should search by file path', () => {
      addError(createError('e5', 'Error', { file: 'src/components/Button.tsx' }));

      search('button');

      expect(getFilteredCount()).toBe(1);
    });

    it('should search by error code', () => {
      addError(createError('e5', 'Error', { code: 'TS2304' }));

      search('ts2304');

      expect(getFilteredCount()).toBe(1);
    });
  });

  describe('Timestamp Filtering', () => {
    beforeEach(() => {
      addError(createError('e1', 'Old error', { timestamp: 1000 }));
      addError(createError('e2', 'Middle error', { timestamp: 2000 }));
      addError(createError('e3', 'New error', { timestamp: 3000 }));
    });

    describe('filterByTimeRange', () => {
      it('should filter by time range', () => {
        filterByTimeRange(1500, 2500);

        expect(getFilteredCount()).toBe(1);
        expect(getFilteredErrors()[0].id).toBe('e2');
      });

      it('should handle null from timestamp', () => {
        filterByTimeRange(null, 2500);

        expect(getFilteredCount()).toBe(2);
      });

      it('should handle null to timestamp', () => {
        filterByTimeRange(1500, null);

        expect(getFilteredCount()).toBe(2);
      });
    });

    describe('filterFromTimestamp', () => {
      it('should filter from timestamp', () => {
        filterFromTimestamp(2000);

        expect(getFilteredCount()).toBe(2);
      });
    });

    describe('filterToTimestamp', () => {
      it('should filter to timestamp', () => {
        filterToTimestamp(2000);

        expect(getFilteredCount()).toBe(2);
      });
    });

    describe('clearTimeFilter', () => {
      it('should clear time filter', () => {
        filterByTimeRange(1500, 2500);
        clearTimeFilter();

        expect(getFilteredCount()).toBe(3);
        expect(getFilter().fromTimestamp).toBeNull();
        expect(getFilter().toTimestamp).toBeNull();
      });
    });
  });

  describe('Code Filtering', () => {
    beforeEach(() => {
      addError(createError('e1', 'Error 1', { code: 'TS2304' }));
      addError(createError('e2', 'Error 2', { code: 'TS2322' }));
      addError(createError('e3', 'Error 3', { code: 'TS2304' }));
      addError(createError('e4', 'Error 4', { code: null }));
    });

    describe('filterByCode', () => {
      it('should filter by single code', () => {
        filterByCode('TS2304');

        expect(getFilteredCount()).toBe(2);
      });
    });

    describe('filterByCodes', () => {
      it('should filter by multiple codes', () => {
        filterByCodes(['TS2304', 'TS2322']);

        expect(getFilteredCount()).toBe(3);
      });
    });

    describe('addCodeFilter', () => {
      it('should add code to filter', () => {
        filterByCode('TS2304');
        addCodeFilter('TS2322');

        expect(getFilteredCount()).toBe(3);
      });

      it('should not duplicate code', () => {
        filterByCode('TS2304');
        addCodeFilter('TS2304');

        expect(getFilter().codes.length).toBe(1);
      });
    });

    describe('removeCodeFilter', () => {
      it('should remove code from filter', () => {
        filterByCodes(['TS2304', 'TS2322']);
        removeCodeFilter('TS2322');

        expect(getFilteredCount()).toBe(2);
      });
    });
  });

  describe('Combined Filters', () => {
    beforeEach(() => {
      addError(createError('e1', 'Syntax error', { severity: 'error', category: 'syntax', file: 'app.ts' }));
      addError(createError('e2', 'Type warning', { severity: 'warning', category: 'type', file: 'app.ts' }));
      addError(createError('e3', 'Runtime error', { severity: 'error', category: 'runtime', file: 'main.ts' }));
      addError(createError('e4', 'Type error', { severity: 'error', category: 'type', file: 'main.ts' }));
    });

    it('should combine severity and category filters', () => {
      filterBySeverity('error');
      addCategoryFilter('type');

      expect(getFilteredCount()).toBe(1);
      expect(getFilteredErrors()[0].id).toBe('e4');
    });

    it('should combine severity and file filters', () => {
      filterBySeverity('error');
      addFileFilter('app.ts');

      expect(getFilteredCount()).toBe(1);
      expect(getFilteredErrors()[0].id).toBe('e1');
    });

    it('should combine search with other filters', () => {
      search('type');
      filterBySeverity('error');

      expect(getFilteredCount()).toBe(1);
      expect(getFilteredErrors()[0].id).toBe('e4');
    });
  });

  describe('Filter Management', () => {
    describe('setFilter', () => {
      it('should set partial filter', () => {
        setFilter({ severities: ['error'] });

        expect(getFilter().severities).toEqual(['error']);
        expect(getFilter().categories).toEqual([]);
      });

      it('should merge with existing filter', () => {
        setFilter({ severities: ['error'] });
        setFilter({ categories: ['syntax'] });

        expect(getFilter().severities).toEqual(['error']);
        expect(getFilter().categories).toEqual(['syntax']);
      });
    });

    describe('resetFilter', () => {
      it('should reset all filters', () => {
        setFilter({
          severities: ['error'],
          categories: ['syntax'],
          files: ['app.ts'],
          searchQuery: 'test',
        });

        resetFilter();

        const filter = getFilter();
        expect(filter.severities).toEqual([]);
        expect(filter.categories).toEqual([]);
        expect(filter.files).toEqual([]);
        expect(filter.searchQuery).toBe('');
      });
    });

    describe('clearFilterField', () => {
      it('should clear severities field', () => {
        setFilter({ severities: ['error', 'warning'] });
        clearFilterField('severities');

        expect(getFilter().severities).toEqual([]);
      });

      it('should clear searchQuery field', () => {
        setFilter({ searchQuery: 'test' });
        clearFilterField('searchQuery');

        expect(getFilter().searchQuery).toBe('');
      });

      it('should clear timestamp fields', () => {
        setFilter({ fromTimestamp: 1000, toTimestamp: 2000 });
        clearFilterField('fromTimestamp');

        expect(getFilter().fromTimestamp).toBeNull();
        expect(getFilter().toTimestamp).toBe(2000);
      });
    });

    describe('hasActiveFilter', () => {
      it('should return false when no filters active', () => {
        expect(hasActiveFilter()).toBe(false);
      });

      it('should return true when severity filter active', () => {
        filterBySeverity('error');

        expect(hasActiveFilter()).toBe(true);
      });

      it('should return true when search active', () => {
        search('test');

        expect(hasActiveFilter()).toBe(true);
      });
    });
  });

  describe('Filter Results', () => {
    beforeEach(() => {
      addError(createError('e1', 'Error 1', { severity: 'error' }));
      addError(createError('e2', 'Error 2', { severity: 'warning' }));
      addError(createError('e3', 'Error 3', { severity: 'error' }));
    });

    describe('getFilterResult', () => {
      it('should return complete filter result', () => {
        filterBySeverity('error');

        const result = getFilterResult();

        expect(result.totalCount).toBe(3);
        expect(result.filteredCount).toBe(2);
        expect(result.errors.length).toBe(2);
        expect(result.appliedFilters).toContain('severity: error');
      });

      it('should list all applied filters', () => {
        setFilter({
          severities: ['error'],
          categories: ['syntax'],
          searchQuery: 'test',
        });

        const result = getFilterResult();

        expect(result.appliedFilters.length).toBe(3);
      });
    });
  });

  describe('Summary and Statistics', () => {
    beforeEach(() => {
      addError(createError('e1', 'E1', { severity: 'error', category: 'syntax', file: 'a.ts', code: 'TS1' }));
      addError(createError('e2', 'E2', { severity: 'error', category: 'type', file: 'a.ts', code: 'TS2' }));
      addError(createError('e3', 'E3', { severity: 'warning', category: 'syntax', file: 'b.ts', code: 'TS1' }));
      addError(createError('e4', 'E4', { severity: 'info', category: 'other', file: null, code: null }));
    });

    describe('getFilterSummary', () => {
      it('should return severity counts', () => {
        const summary = getFilterSummary();

        expect(summary.severityCounts.error).toBe(2);
        expect(summary.severityCounts.warning).toBe(1);
        expect(summary.severityCounts.info).toBe(1);
        expect(summary.severityCounts.hint).toBe(0);
      });

      it('should return category counts', () => {
        const summary = getFilterSummary();

        expect(summary.categoryCounts.syntax).toBe(2);
        expect(summary.categoryCounts.type).toBe(1);
        expect(summary.categoryCounts.other).toBe(1);
      });

      it('should return file counts', () => {
        const summary = getFilterSummary();

        expect(summary.fileCounts['a.ts']).toBe(2);
        expect(summary.fileCounts['b.ts']).toBe(1);
      });

      it('should return code counts', () => {
        const summary = getFilterSummary();

        expect(summary.codeCounts['TS1']).toBe(2);
        expect(summary.codeCounts['TS2']).toBe(1);
      });
    });

    describe('getUniqueFiles', () => {
      it('should return unique files sorted', () => {
        const files = getUniqueFiles();

        expect(files).toEqual(['a.ts', 'b.ts']);
      });
    });

    describe('getUniqueCodes', () => {
      it('should return unique codes sorted', () => {
        const codes = getUniqueCodes();

        expect(codes).toEqual(['TS1', 'TS2']);
      });
    });

    describe('getUniqueSources', () => {
      it('should return unique sources sorted', () => {
        addError(createError('e5', 'E5', { source: 'eslint' }));
        addError(createError('e6', 'E6', { source: 'typescript' }));

        const sources = getUniqueSources();

        expect(sources).toEqual(['eslint', 'typescript']);
      });
    });
  });

  describe('Quick Filters', () => {
    beforeEach(() => {
      addError(createError('e1', 'Error', { severity: 'error' }));
      addError(createError('e2', 'Warning', { severity: 'warning' }));
      addError(createError('e3', 'Info', { severity: 'info' }));
    });

    describe('showErrorsOnly', () => {
      it('should show only errors', () => {
        showErrorsOnly();

        expect(getFilteredCount()).toBe(1);
        expect(getFilteredErrors()[0].severity).toBe('error');
      });
    });

    describe('showWarningsOnly', () => {
      it('should show only warnings', () => {
        showWarningsOnly();

        expect(getFilteredCount()).toBe(1);
        expect(getFilteredErrors()[0].severity).toBe('warning');
      });
    });

    describe('showErrorsAndWarnings', () => {
      it('should show errors and warnings', () => {
        showErrorsAndWarnings();

        expect(getFilteredCount()).toBe(2);
      });
    });

    describe('showAll', () => {
      it('should reset filter and show all', () => {
        showErrorsOnly();
        showAll();

        expect(getFilteredCount()).toBe(3);
        expect(hasActiveFilter()).toBe(false);
      });
    });
  });

  describe('State and Reset', () => {
    describe('getState', () => {
      it('should return current state', () => {
        addError(createError('e1', 'Error 1'));
        filterBySeverity('error');

        const state = getState();

        expect(state.errors.size).toBe(1);
        expect(state.filter.severities).toContain('error');
      });
    });

    describe('resetErrorFilter', () => {
      it('should reset all state', () => {
        addError(createError('e1', 'Error 1'));
        filterBySeverity('error');

        resetErrorFilter();

        expect(getErrorCount()).toBe(0);
        expect(hasActiveFilter()).toBe(false);
      });
    });
  });

  describe('Utilities', () => {
    describe('getAllSeverities', () => {
      it('should return all severity options', () => {
        const severities = getAllSeverities();

        expect(severities).toContain('error');
        expect(severities).toContain('warning');
        expect(severities).toContain('info');
        expect(severities).toContain('hint');
      });
    });

    describe('getAllCategories', () => {
      it('should return all category options', () => {
        const categories = getAllCategories();

        expect(categories).toContain('syntax');
        expect(categories).toContain('type');
        expect(categories).toContain('runtime');
        expect(categories).toContain('validation');
        expect(categories).toContain('network');
        expect(categories).toContain('security');
        expect(categories).toContain('performance');
        expect(categories).toContain('deprecation');
        expect(categories).toContain('other');
      });
    });

    describe('createError', () => {
      it('should create error with defaults', () => {
        const error = createError('e1', 'Test message');

        expect(error.id).toBe('e1');
        expect(error.message).toBe('Test message');
        expect(error.severity).toBe('error');
        expect(error.category).toBe('other');
        expect(error.file).toBeNull();
        expect(error.timestamp).toBeGreaterThan(0);
      });

      it('should create error with options', () => {
        const error = createError('e1', 'Test', {
          severity: 'warning',
          category: 'syntax',
          file: 'test.ts',
          line: 10,
          column: 5,
          code: 'TS1234',
          source: 'typescript',
        });

        expect(error.severity).toBe('warning');
        expect(error.category).toBe('syntax');
        expect(error.file).toBe('test.ts');
        expect(error.line).toBe(10);
        expect(error.column).toBe(5);
        expect(error.code).toBe('TS1234');
        expect(error.source).toBe('typescript');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty error list', () => {
      expect(getFilteredErrors()).toEqual([]);
      expect(getFilteredCount()).toBe(0);
      expect(getFilterResult().totalCount).toBe(0);
    });

    it('should handle empty search query', () => {
      addError(createError('e1', 'Test error'));
      search('');

      expect(getFilteredCount()).toBe(1);
    });

    it('should handle whitespace-only search', () => {
      addError(createError('e1', 'Test error'));
      search('   ');

      expect(getFilteredCount()).toBe(1);
    });

    it('should handle special characters in search', () => {
      addError(createError('e1', 'Error: cannot parse (invalid)'));
      search('parse');

      expect(getFilteredCount()).toBe(1);
    });

    it('should handle filter with no matches', () => {
      addError(createError('e1', 'Error', { severity: 'error' }));
      filterBySeverity('hint');

      expect(getFilteredCount()).toBe(0);
    });

    it('should update filtered results when errors change', () => {
      filterBySeverity('error');
      addError(createError('e1', 'Error 1', { severity: 'error' }));
      addError(createError('e2', 'Warning 1', { severity: 'warning' }));

      expect(getFilteredCount()).toBe(1);

      addError(createError('e3', 'Error 2', { severity: 'error' }));

      expect(getFilteredCount()).toBe(2);
    });
  });
});
