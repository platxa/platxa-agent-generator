/**
 * Migration Script Generator — Odoo Theme Version Upgrades
 *
 * Generates pre-migration and post-migration Python scripts
 * for upgrading Odoo themes between versions (16→17, 17→18).
 */

import type { OdooVersion } from "./odoo-compat";

// =============================================================================
// Types
// =============================================================================

/** A single migration step within a script */
export interface MigrationStep {
  /** Description of what this step does */
  description: string;
  /** Python code for the step */
  code: string;
  /** Whether this step is critical (failure should abort) */
  critical: boolean;
}

/** A complete migration script (pre or post) */
export interface MigrationScript {
  /** "pre" or "post" */
  phase: "pre" | "post";
  /** Source version */
  fromVersion: OdooVersion;
  /** Target version */
  toVersion: OdooVersion;
  /** File path relative to module root */
  filePath: string;
  /** Full Python source code */
  content: string;
  /** Individual steps included */
  steps: MigrationStep[];
}

/** Result of generating migration scripts for a version jump */
export interface MigrationResult {
  /** Module technical name */
  moduleName: string;
  /** Source version */
  fromVersion: OdooVersion;
  /** Target version */
  toVersion: OdooVersion;
  /** Generated scripts */
  scripts: MigrationScript[];
  /** Version hops required (e.g. 16→17→18 = 2 hops) */
  hops: number;
}

/** Known breaking changes between versions */
export interface BreakingChange {
  /** Affected versions (from→to) */
  fromVersion: OdooVersion;
  toVersion: OdooVersion;
  /** Category of change */
  category: "api" | "template" | "scss" | "manifest" | "asset";
  /** Description */
  description: string;
  /** Pre-migration step (runs before module update) */
  preMigration?: MigrationStep;
  /** Post-migration step (runs after module update) */
  postMigration?: MigrationStep;
}

// =============================================================================
// Breaking Changes Registry
// =============================================================================

const BREAKING_CHANGES: BreakingChange[] = [
  // 16.0 → 17.0
  {
    fromVersion: "16.0",
    toVersion: "17.0",
    category: "manifest",
    description: "license field required in __manifest__.py",
    postMigration: {
      description: "Add license field to manifest if missing",
      code: `    # Ensure license field exists in manifest
    env.cr.execute("""
        UPDATE ir_module_module
        SET license = 'LGPL-3'
        WHERE name = %(module)s AND (license IS NULL OR license = '')
    """, {'module': module_name})`,
      critical: false,
    },
  },
  {
    fromVersion: "16.0",
    toVersion: "17.0",
    category: "asset",
    description: "Asset bundle names changed from web.assets_frontend to website.assets_frontend",
    preMigration: {
      description: "Rename asset bundle references",
      code: `    # Update asset bundle references from web.assets_frontend to website.assets_frontend
    env.cr.execute("""
        UPDATE ir_asset
        SET bundle = REPLACE(bundle, 'web.assets_frontend', 'website.assets_frontend')
        WHERE bundle LIKE '%%web.assets_frontend%%'
    """)`,
      critical: true,
    },
  },
  {
    fromVersion: "16.0",
    toVersion: "17.0",
    category: "template",
    description: "QWeb directive t-attf- deprecated for simple attributes",
    postMigration: {
      description: "Log warning about deprecated t-attf directives",
      code: `    # Log deprecated t-attf usage for manual review
    _logger.warning(
        "Module %s may contain deprecated t-attf- directives. "
        "Review templates and replace with t-att- where appropriate.",
        module_name
    )`,
      critical: false,
    },
  },
  {
    fromVersion: "16.0",
    toVersion: "17.0",
    category: "scss",
    description: "Bootstrap 5.3 SCSS variable renames",
    postMigration: {
      description: "Update Bootstrap SCSS variable references in ir.asset",
      code: `    # Update deprecated Bootstrap SCSS variables
    replacements = {
        '$gray-200': '$border-color',
        '$gray-800': '$body-color',
    }
    for old_var, new_var in replacements.items():
        env.cr.execute("""
            UPDATE ir_asset
            SET path = REPLACE(path, %(old)s, %(new)s)
            WHERE path LIKE %(pattern)s
        """, {'old': old_var, 'new': new_var, 'pattern': f'%%{old_var}%%'})`,
      critical: false,
    },
  },
  // 17.0 → 18.0
  {
    fromVersion: "17.0",
    toVersion: "18.0",
    category: "api",
    description: "ir.qweb render method signature changed",
    postMigration: {
      description: "Update ir.qweb render calls",
      code: `    # ir.qweb._render() signature changed - log for manual review
    _logger.info(
        "Module %s: Review any direct ir.qweb._render() calls. "
        "The method signature changed in 18.0.",
        module_name
    )`,
      critical: false,
    },
  },
  {
    fromVersion: "17.0",
    toVersion: "18.0",
    category: "manifest",
    description: "Python 3.12+ required, update classifiers",
    postMigration: {
      description: "Update Python version classifiers",
      code: `    # Update Python classifiers in manifest data
    env.cr.execute("""
        UPDATE ir_module_module
        SET description = REPLACE(
            COALESCE(description, ''),
            'Python :: 3.10',
            'Python :: 3.12'
        )
        WHERE name = %(module)s
    """, {'module': module_name})`,
      critical: false,
    },
  },
  {
    fromVersion: "17.0",
    toVersion: "18.0",
    category: "template",
    description: "Website page controller routing changed",
    preMigration: {
      description: "Backup website page routes before migration",
      code: `    # Backup custom page routes before migration
    env.cr.execute("""
        CREATE TABLE IF NOT EXISTS _theme_migration_routes_backup AS
        SELECT id, url, view_id
        FROM website_page
        WHERE website_id IS NOT NULL
    """)
    _logger.info("Backed up website page routes for module %s", module_name)`,
      critical: true,
    },
    postMigration: {
      description: "Restore website page routes after migration",
      code: `    # Restore custom page routes if backup exists
    env.cr.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = '_theme_migration_routes_backup'
        )
    """)
    if env.cr.fetchone()[0]:
        env.cr.execute("""
            UPDATE website_page wp
            SET url = backup.url
            FROM _theme_migration_routes_backup backup
            WHERE wp.id = backup.id
        """)
        env.cr.execute("DROP TABLE _theme_migration_routes_backup")
        _logger.info("Restored website page routes for module %s", module_name)`,
      critical: false,
    },
  },
  {
    fromVersion: "17.0",
    toVersion: "18.0",
    category: "scss",
    description: "CSS custom properties required instead of SCSS variables for theming",
    postMigration: {
      description: "Log SCSS-to-CSS-custom-properties migration notice",
      code: `    _logger.warning(
        "Module %s: Odoo 18.0 prefers CSS custom properties over SCSS variables "
        "for theme colors. Review and update SCSS files.",
        module_name
    )`,
      critical: false,
    },
  },
];

// =============================================================================
// Version Utilities
// =============================================================================

const VERSION_ORDER: OdooVersion[] = ["16.0", "17.0", "18.0"];

/** Returns the list of version hops needed (e.g. 16→18 = [[16,17],[17,18]]) */
export function getVersionHops(
  from: OdooVersion,
  to: OdooVersion,
): Array<[OdooVersion, OdooVersion]> {
  const fromIdx = VERSION_ORDER.indexOf(from);
  const toIdx = VERSION_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) return [];

  const hops: Array<[OdooVersion, OdooVersion]> = [];
  for (let i = fromIdx; i < toIdx; i++) {
    hops.push([VERSION_ORDER[i], VERSION_ORDER[i + 1]]);
  }
  return hops;
}

/** Returns breaking changes for a specific version transition */
export function getBreakingChanges(
  from: OdooVersion,
  to: OdooVersion,
): BreakingChange[] {
  return BREAKING_CHANGES.filter(
    (c) => c.fromVersion === from && c.toVersion === to,
  );
}

// =============================================================================
// Script Generation
// =============================================================================

function generatePythonHeader(
  phase: "pre" | "post",
  fromVersion: OdooVersion,
  toVersion: OdooVersion,
  moduleName: string,
): string {
  return `# -*- coding: utf-8 -*-
# Migration script: ${phase}-migration ${fromVersion} → ${toVersion}
# Module: ${moduleName}
# Auto-generated by Platxa Migration Generator

import logging

_logger = logging.getLogger(__name__)


def migrate(env, version):
    """${phase === "pre" ? "Pre" : "Post"}-migration from ${fromVersion} to ${toVersion}."""
    module_name = "${moduleName}"
    _logger.info(
        "${phase === "pre" ? "Pre" : "Post"}-migrating %s from ${fromVersion} to ${toVersion}",
        module_name,
    )
`;
}

function generateStepCode(step: MigrationStep, index: number): string {
  const tryBlock = step.critical
    ? `
    # Step ${index + 1}: ${step.description}
    try:
${step.code.split("\n").map((l) => `    ${l}`).join("\n")}
    except Exception as e:
        _logger.error("Critical migration step failed: %s", e)
        raise
`
    : `
    # Step ${index + 1}: ${step.description}
    try:
${step.code.split("\n").map((l) => `    ${l}`).join("\n")}
    except Exception:
        _logger.warning("Non-critical migration step failed: ${step.description}")
`;
  return tryBlock;
}

/** Generates a single migration script */
export function generateScript(
  phase: "pre" | "post",
  fromVersion: OdooVersion,
  toVersion: OdooVersion,
  moduleName: string,
  steps: MigrationStep[],
): MigrationScript {
  if (steps.length === 0) {
    const content =
      generatePythonHeader(phase, fromVersion, toVersion, moduleName) +
      `    _logger.info("No ${phase}-migration steps needed for %s", module_name)\n`;
    return {
      phase,
      fromVersion,
      toVersion,
      filePath: `migrations/${toVersion}/${phase}-migrate.py`,
      content,
      steps: [],
    };
  }

  let content = generatePythonHeader(phase, fromVersion, toVersion, moduleName);
  for (let i = 0; i < steps.length; i++) {
    content += generateStepCode(steps[i], i);
  }
  content += `
    _logger.info(
        "${phase === "pre" ? "Pre" : "Post"}-migration complete for %s (${fromVersion} → ${toVersion})",
        module_name,
    )
`;

  return {
    phase,
    fromVersion,
    toVersion,
    filePath: `migrations/${toVersion}/${phase}-migrate.py`,
    content,
    steps,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generates all migration scripts needed for a version upgrade.
 * Handles multi-hop upgrades (e.g. 16→18 generates scripts for 16→17 and 17→18).
 */
export function generateMigration(
  moduleName: string,
  fromVersion: OdooVersion,
  toVersion: OdooVersion,
): MigrationResult {
  const hops = getVersionHops(fromVersion, toVersion);
  const scripts: MigrationScript[] = [];

  for (const [hopFrom, hopTo] of hops) {
    const changes = getBreakingChanges(hopFrom, hopTo);

    const preSteps = changes
      .filter((c) => c.preMigration != null)
      .map((c) => c.preMigration!);

    const postSteps = changes
      .filter((c) => c.postMigration != null)
      .map((c) => c.postMigration!);

    scripts.push(generateScript("pre", hopFrom, hopTo, moduleName, preSteps));
    scripts.push(generateScript("post", hopFrom, hopTo, moduleName, postSteps));
  }

  return {
    moduleName,
    fromVersion,
    toVersion,
    scripts,
    hops: hops.length,
  };
}
