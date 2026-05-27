# Shard Manifest — test_generator.py

Maps each `TestXxx` class in `tests/test_generator.py` to its target shard file under `tests/`.

## Summary

- **Source**: `tests/test_generator.py` (19,604 lines)
- **Classes**: 107 `TestXxx` classes
- **Tests**: 941 (pytest `--collect-only` count)
- **Target modules**: 31 shards under `tests/`
- **Fixture scope**: All 15 fixtures in `tests/conftest.py` use pytest's default **function** scope (none are class-scoped or mixin-based). They remain in `tests/conftest.py` and are auto-discovered by every sibling test module, so no fixture needs to be relocated or duplicated when sharding. No cross-module fixture splits required.

> **Spec note**: The feature-#7 criteria mentions `sum to 1114`; the pre-elimination pytest count was 997 for `test_generator.py` alone (now 981 after Category A eliminations removed `claudemd_generator.py` and its 12 dedicated tests, plus 4 tests from `test_catalog.py`; 14 prompt_generator tests were relocated to `test_prompt_structure.py`). The workspace total including `tests/test_security_scanner.py` (119) and the two shard-added tests from feature #8 was 1116, matching feature-#8's SC1/SC14.

## Per-Module Totals

| Target module | Classes | Tests |
|---|---:|---:|
| `tests/test_hooks.py` | 10 | 133 |
| `tests/test_validation.py` | 6 | 37 |
| `tests/test_composition.py` | 5 | 58 |
| `tests/test_prompt_structure.py` | 6 | 69 |
| `tests/test_patterns.py` | 6 | 51 |
| `tests/test_catalog.py` | 3 | 44 |
| `tests/test_tool_selection.py` | 6 | 32 |
| `tests/test_versioning.py` | 5 | 41 |
| `tests/test_skills_commands.py` | 3 | 39 |
| `tests/test_nlp.py` | 3 | 34 |
| `tests/test_domain_docs.py` | 3 | 31 |
| `tests/test_integration.py` | 5 | 30 |
| `tests/test_thinking.py` | 2 | 30 |
| `tests/test_workflow.py` | 3 | 18 |
| `tests/test_completeness.py` | 3 | 28 |
| `tests/test_examples.py` | 3 | 27 |
| `tests/test_install.py` | 4 | 24 |
| `tests/test_state.py` | 5 | 24 |
| `tests/test_security_analysis.py` | 4 | 22 |
| `tests/test_batch.py` | 2 | 20 |
| `tests/test_quality_scoring.py` | 3 | 20 |
| `tests/test_plugin_export.py` | 2 | 17 |
| `tests/test_frontmatter_flags.py` | 2 | 16 |
| `tests/test_type_classification.py` | 3 | 16 |
| `tests/test_dryrun.py` | 2 | 14 |
| `tests/test_conftest_check.py` | 1 | 12 |
| `tests/test_analyzer.py` | 1 | 11 |
| `tests/test_progress_tracking.py` | 1 | 11 |
| `tests/test_generators.py` | 2 | 7 |
| `tests/test_composer.py` | 1 | 2 |
| **TOTAL** | **107** | **941** |

## Class → Module Map

| # | Class | Source line | Tests | Target module |
|---:|---|---:|---:|---|
| 1 | `TestSyntaxValidator` | 25 | 11 | `tests/test_validation.py` |
| 2 | `TestTypeClassifier` | 354 | 6 | `tests/test_type_classification.py` |
| 3 | `TestTypeClassifierMaxTurns` | 425 | 5 | `tests/test_type_classification.py` |
| 4 | `TestModelValidation` | 499 | 3 | `tests/test_validation.py` |
| 5 | `TestModelRouting` | 595 | 5 | `tests/test_type_classification.py` |
| 6 | `TestDisallowedToolsValidation` | 669 | 4 | `tests/test_validation.py` |
| 7 | `TestDisallowedToolsRecommendation` | 797 | 3 | `tests/test_validation.py` |
| 8 | `TestRemainingFrontmatterValidation` | 864 | 10 | `tests/test_validation.py` |
| 9 | `TestMcpServersValidation` | 957 | 6 | `tests/test_validation.py` |
| 10 | `TestHooksRecommendation` | 1094 | 9 | `tests/test_hooks.py` |
| 11 | `TestPreToolUseDenyScript` | 1217 | 9 | `tests/test_hooks.py` |
| 12 | `TestPostToolUseLintScript` | 1347 | 17 | `tests/test_hooks.py` |
| 13 | `TestStopVerificationScript` | 1518 | 14 | `tests/test_hooks.py` |
| 14 | `TestHooksGeneratorTaskCompleted` | 1665 | 8 | `tests/test_hooks.py` |
| 15 | `TestHookScriptGeneration` | 1812 | 8 | `tests/test_hooks.py` |
| 16 | `TestQualityScorerNewFields` | 1917 | 5 | `tests/test_quality_scoring.py` |
| 17 | `TestSecurityScanner` | 2052 | 2 | `tests/test_security_analysis.py` |
| 18 | `TestErrorHandlingGeneration` | 2159 | 9 | `tests/test_quality_scoring.py` |
| 19 | `TestContextBudgetEstimation` | 2241 | 6 | `tests/test_quality_scoring.py` |
| 20 | `TestCredentialLeakDetection` | 2315 | 6 | `tests/test_security_analysis.py` |
| 21 | `TestToolCombinationRiskMatrix` | 2399 | 8 | `tests/test_security_analysis.py` |
| 22 | `TestMAESTROAnalysis` | 2516 | 6 | `tests/test_security_analysis.py` |
| 23 | `TestWorkflowState` | 2639 | 4 | `tests/test_workflow.py` |
| 24 | `TestToolSelector` | 2790 | 4 | `tests/test_workflow.py` |
| 26 | `TestMultiAgentGenerator` | 2938 | 4 | `tests/test_generators.py` |
| 27 | `TestPromptGenerator` | 3033 | 3 | `tests/test_generators.py` |
| 28 | `TestInstallAgent` | 3110 | 6 | `tests/test_install.py` |
| 29 | `TestInstallAgentSubprocess` | 3381 | 3 | `tests/test_install.py` |
| 30 | `TestIntegration` | 3486 | 2 | `tests/test_integration.py` |
| 31 | `TestPromptChainingPattern` | 3584 | 11 | `tests/test_patterns.py` |
| 32 | `TestOtherPatternTemplates` | 3919 | 3 | `tests/test_patterns.py` |
| 33 | `TestMultiAgentRoutingPattern` | 4010 | 8 | `tests/test_patterns.py` |
| 34 | `TestMultiAgentEvaluatorOptimizerPattern` | 4204 | 9 | `tests/test_patterns.py` |
| 35 | `TestMultiAgentParallelizationPattern` | 4420 | 9 | `tests/test_patterns.py` |
| 36 | `TestVerificationSectionGeneration` | 4627 | 9 | `tests/test_examples.py` |
| 37 | `TestEnhancedExampleGeneration` | 4860 | 10 | `tests/test_examples.py` |
| 38 | `TestLeastPrivilegeToolSelection` | 4974 | 10 | `tests/test_tool_selection.py` |
| 39 | `TestAgentTeamCompatibility` | 5092 | 9 | `tests/test_tool_selection.py` |
| 40 | `TestSharedPaths` | 5189 | 2 | `tests/test_tool_selection.py` |
| 41 | `TestSharedFrontmatter` | 5260 | 3 | `tests/test_tool_selection.py` |
| 42 | `TestSharedToolUtils` | 5384 | 2 | `tests/test_tool_selection.py` |
| 43 | `TestSharedTaskListTemplate` | 5480 | 8 | `tests/test_tool_selection.py` |
| 44 | `TestLiveAgentInvocation` | 5570 | 9 | `tests/test_integration.py` |
| 45 | `TestTestHarnessExitCode` | 5841 | 2 | `tests/test_integration.py` |
| 46 | `TestAutoGenerateTestsFromExamples` | 5971 | 8 | `tests/test_examples.py` |
| 47 | `TestGeneratorRegressionSuite` | 6172 | 12 | `tests/test_integration.py` |
| 48 | `TestCompletenessCheckerRequiredSections` | 6410 | 8 | `tests/test_completeness.py` |
| 49 | `TestAgentCatalogSeeding` | 6633 | 11 | `tests/test_catalog.py` |
| 50 | `TestDomainDetection` | 6818 | 12 | `tests/test_composition.py` |
| 51 | `TestCompositionValidation` | 6917 | 10 | `tests/test_composition.py` |
| 52 | `TestContextAwareDiscovery` | 7071 | 10 | `tests/test_composition.py` |
| 53 | `TestNonInteractiveMode` | 7269 | 10 | `tests/test_workflow.py` |
| 54 | `TestConftestFixtures` | 7408 | 12 | `tests/test_conftest_check.py` |
| 55 | `TestEndToEndGeneration` | 7521 | 5 | `tests/test_integration.py` |
| 56 | `TestMultiAgentHooks` | 7696 | 22 | `tests/test_hooks.py` |
| 57 | `TestWriterReviewerTemplate` | 8101 | 11 | `tests/test_patterns.py` |
| 58 | `TestDryRunPreviewEnhancements` | 8277 | 12 | `tests/test_dryrun.py` |
| 59 | `TestToolWorkflowCrossValidation` | 8509 | 8 | `tests/test_tool_selection.py` |
| 60 | `TestCatalogSearchAndFilter` | 8742 | 16 | `tests/test_catalog.py` |
| 61 | `TestNLPConstraintExtraction` | 8991 | 14 | `tests/test_nlp.py` |
| 62 | `TestNLPComplexityEstimation` | 9205 | 14 | `tests/test_nlp.py` |
| 63 | `TestNlpParserMalformedInput` | 9410 | 6 | `tests/test_nlp.py` |
| 64 | `TestPromptReminderPoints` | 9600 | 11 | `tests/test_prompt_structure.py` |
| 65 | `TestFourBlockPromptStructure` | 9735 | 13 | `tests/test_prompt_structure.py` |
| 66 | `TestXmlNestedTagStructure` | 9937 | 12 | `tests/test_prompt_structure.py` |
| 67 | `TestAgentDiffComparison` | 10148 | 12 | `tests/test_versioning.py` |
| 68 | `TestAgentVersioning` | 10354 | 3 | `tests/test_versioning.py` |
| 69 | `TestPluginExport` | 10568 | 10 | `tests/test_plugin_export.py` |
| 70 | `TestProgressTrackerTodoWrite` | 10815 | 11 | `tests/test_progress_tracking.py` |
| 71 | `TestDomainKnowledgeImports` | 11036 | 10 | `tests/test_domain_docs.py` |
| 72 | `TestAgentDependencyDocumentation` | 11225 | 11 | `tests/test_domain_docs.py` |
| 73 | `TestGenerationAttributionFooter` | 11452 | 10 | `tests/test_domain_docs.py` |
| 74 | `TestAgentRegenerationWorkflow` | 11622 | 11 | `tests/test_versioning.py` |
| 75 | `TestAgentExportBundle` | 11812 | 7 | `tests/test_plugin_export.py` |
| 77 | `TestAgentAnalyzer` | 12113 | 11 | `tests/test_analyzer.py` |
| 78 | `TestAgentUpgrader` | 12322 | 13 | `tests/test_versioning.py` |
| 79 | `TestComposeRouter` | 12562 | 14 | `tests/test_composition.py` |
| 80 | `TestCompositionDepthLimit` | 12779 | 12 | `tests/test_composition.py` |
| 81 | `TestSkillsFrontmatter` | 12930 | 15 | `tests/test_skills_commands.py` |
| 82 | `TestCompanionSkillGeneration` | 13186 | 11 | `tests/test_skills_commands.py` |
| 83 | `TestCompanionCommandGeneration` | 13387 | 13 | `tests/test_skills_commands.py` |
| 85 | `TestStateCheckpointRecovery` | 13800 | 12 | `tests/test_state.py` |
| 86 | `TestStatePersistenceErrorHandling` | 13995 | 4 | `tests/test_state.py` |
| 87 | `TestStatePersistenceConfig` | 14130 | 3 | `tests/test_state.py` |
| 88 | `TestStatePersistenceWriteSurfacing` | 14239 | 3 | `tests/test_state.py` |
| 89 | `TestExtendedThinkingLoadHistory` | 14387 | 2 | `tests/test_thinking.py` |
| 90 | `TestSilentWriteSurfacing` | 14504 | 2 | `tests/test_state.py` |
| 91 | `TestAgentComposerScan` | 14603 | 2 | `tests/test_composer.py` |
| 92 | `TestBatchGeneration` | 14735 | 11 | `tests/test_batch.py` |
| 93 | `TestBatchPolicy` | 14967 | 9 | `tests/test_batch.py` |
| 94 | `TestInstallScopeRecommender` | 15204 | 8 | `tests/test_install.py` |
| 98 | `TestGenerationReport` | 16165 | 10 | `tests/test_completeness.py` |
| 99 | `TestAgentLint` | 16382 | 10 | `tests/test_completeness.py` |
| 100 | `TestPostInstallVerification` | 16562 | 7 | `tests/test_install.py` |
| 103 | `TestBackgroundFrontmatter` | 16974 | 8 | `tests/test_frontmatter_flags.py` |
| 104 | `TestColorFrontmatter` | 17095 | 8 | `tests/test_frontmatter_flags.py` |
| 105 | `TestSubagentAuditHooks` | 17211 | 16 | `tests/test_hooks.py` |
| 106 | `TestHooksGeneratorAuditHook` | 17606 | 2 | `tests/test_hooks.py` |
| 107 | `TestCompetingHypothesisTemplate` | 17716 | 19 | `tests/test_prompt_structure.py` |
| — | `TestContextManagementSection` | — | 7 | `tests/test_prompt_structure.py` |
| — | `TestSubagentDelegationSection` | — | 7 | `tests/test_prompt_structure.py` |
| 108 | `TestCatalogTemplateInheritance` | 18074 | 17 | `tests/test_catalog.py` |
| 109 | `TestHooksGeneratorInjection` | 18464 | 28 | `tests/test_hooks.py` |
| 110 | `TestDryRunImportBroken` | 18702 | 2 | `tests/test_dryrun.py` |
| 111 | `TestExtendedThinking` | 18811 | 28 | `tests/test_thinking.py` |
| 112 | `TestVersionBump` | 19520 | 2 | `tests/test_versioning.py` |

## Fixture Scope (conftest.py)

All fixtures defined in `tests/conftest.py` use pytest's default **function** scope (no `scope=` argument, no class-level mixins, no `autouse=True`). Every fixture is a simple factory for a single agent-fixture string or file path. They are:

- `full_frontmatter_agent`
- `minimal_agent`
- `agent_with_hooks_config`
- `agent_with_mcp_servers`
- `agent_missing_name`
- `agent_missing_description`
- `agent_missing_tools`
- `agent_invalid_model`
- `agent_invalid_permission_mode`
- `agent_negative_max_turns`
- `agent_empty_frontmatter`
- `agent_no_frontmatter`
- `full_agent_file`
- `minimal_agent_file`
- `agents_dir`

These fixtures apply to every shard module via pytest's conftest discovery (conftest.py in the `tests/` directory is shared by all sibling `test_*.py` files). No fixture needs to be duplicated, relocated, or scoped to a specific shard.

## Verification

```bash
test -f .claude/shard-manifest.md              # file exists
grep -c '^|' .claude/shard-manifest.md         # table rows (>= 112 class rows + module totals)
```

<!-- managed by platxa-code-agent feature #7 -->
