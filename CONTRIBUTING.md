# Contributing to Platxa Agent Generator

This is a proprietary project. Contributions are limited to authorized team members.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/platxa/platxa-agent-generator.git
cd platxa-agent-generator

# Install dependencies
pip install -r requirements.txt

# Run tests
pytest .claude/skills/platxa-agent-generator/tests/ -v

# Type checking
pyright .claude/skills/platxa-agent-generator/scripts/

# Linting
ruff check .claude/skills/platxa-agent-generator/scripts/
```

## Code Standards

### Python
- Python 3.10+ required
- Type hints for all functions
- Docstrings for public functions
- Maximum line length: 100 characters

### Quality Gates
All code must pass before merging:
- `pyright` - Zero type errors
- `pytest` - All tests passing
- `ruff` - Zero linting errors

## Project Structure

```
.claude/
├── agents/              # Subagent definitions
└── skills/
    └── platxa-agent-generator/
        ├── scripts/     # Python modules (28 files)
        ├── tests/       # Test suite
        ├── docs/        # User documentation
        ├── references/  # Pattern documentation
        └── templates/   # Agent templates
```

## Commit Convention

Use conventional commits:
- `feat(#ID):` New feature
- `fix(#ID):` Bug fix
- `docs:` Documentation
- `chore:` Maintenance
- `test:` Tests

Example: `feat(#42): Implement agent composition feature`

## Pull Request Process

1. Create feature branch from `main`
2. Implement changes with tests
3. Ensure all quality gates pass
4. Submit PR with description
5. Obtain code review approval
6. Squash and merge

## Contact

For questions, contact the development team at dev@platxa.com.
