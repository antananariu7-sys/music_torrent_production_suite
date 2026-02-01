# Project Rules for AI Agents

This document contains essential rules and conventions for AI agents working on this project. Follow these guidelines to maintain consistency and quality.

---

## Architecture Documentation

**📐 For complete application architecture and design specifications**, see:

→ **[ARCHITECTURE.md](ARCHITECTURE.md)** - Main architecture index
→ **[.architecture/](.architecture/)** - Detailed architecture documents

The architecture documentation covers:
- Application components and data flow
- IPC communication patterns
- Security architecture
- Development roadmap
- TypeScript data models
- Implementation guides

**Important**: Review the architecture before making significant changes to ensure alignment with the overall design.

---

## Git Commit Rules

### Commit Message Structure

Every commit message must follow this structure:

```
Short summary (50 chars or less)

Detailed description of changes wrapped at 72 characters.
Explain what changed and why, not how (the code shows how).

- Bullet points are acceptable
- Use hyphens or asterisks for bullets
- Leave blank lines between bullet points

Additional paragraphs separated by blank lines.
```

### Summary Line Requirements

**Length**: Maximum 50 characters
**Capitalization**: First word must be capitalized
**Mood**: Use imperative present tense
- ✅ "Add feature to handle user auth"
- ✅ "Fix bug in payment processing"
- ✅ "Update documentation for API"
- ❌ "Added feature..." (past tense)
- ❌ "Adds feature..." (third person)
- ❌ "Adding feature..." (continuous)

**No Period**: Do not end the summary line with a period

### Body Section Requirements

**Blank Line**: Always leave the second line blank (critical for Git tools)

**Line Length**: Wrap body text at 72 characters

**Content**: Answer these questions:
- What motivated this change?
- How does it differ from the previous implementation?
- What problem does it solve?

**Formatting**:
- Use bullet points when appropriate
- Separate paragraphs with blank lines
- Use hanging indents for continuation lines

### Commit Best Practices

#### Scope
- **One logical change per commit** - Bundle related changes together
- **Separate unrelated changes** - Different fixes go in different commits
- **Atomic commits** - Each commit should be a complete, working change

#### Examples

**Good Commit:**
```
Add user authentication middleware

Implement JWT-based authentication to secure API endpoints.
This replaces the previous session-based approach for better
scalability with multiple server instances.

- Add auth middleware to validate JWT tokens
- Create token generation utility
- Update user routes to use new middleware
- Add tests for authentication flow
```

**Bad Commit:**
```
fixed stuff and added some features
```

#### Frequency
- **Small, frequent commits** are better than large, infrequent ones
- Commit each logical step rather than all changes at once
- Makes code review easier and history more useful

#### Readiness
- **Only commit completed work** - Don't commit half-finished features
- **Test before committing** - Ensure code works as expected
- **Lint before committing** - Fix code quality issues first

#### What NOT to Commit
- ❌ Commented-out code (delete it; Git preserves history)
- ❌ Debug logs and console statements
- ❌ Temporary files or build artifacts
- ❌ Sensitive data (API keys, passwords, tokens)
- ❌ Large binary files (unless absolutely necessary)
- ❌ Dependencies that should be installed (use package.json)

### Commit Message Types (Optional Convention)

For additional clarity, prefix commits with a type:

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, build config)
- **ci**: CI/CD configuration changes

**Example with type:**
```
feat: Add user authentication middleware

Implement JWT-based authentication to secure API endpoints.
```

---

## Code Quality Rules

### General Principles
- **Write clean, readable code** - Code is read more often than written
- **Follow existing patterns** - Consistency trumps personal preference
- **Comment complex logic** - Explain why, not what
- **Keep functions small** - Each function should do one thing well
- **Avoid premature optimization** - Make it work, then make it fast

### TypeScript/JavaScript Specific
- **Use TypeScript** - Prefer type safety over vanilla JavaScript
- **Explicit types** - Define types rather than relying on inference for public APIs
- **Avoid `any`** - Use proper types or `unknown` if type is truly unknown
- **Destructure imports** - `import { specific } from 'module'` not `import *`

### Error Handling
- **Never swallow errors silently** - At minimum, log them
- **Validate input** - Check parameters at system boundaries
- **Provide context** - Error messages should help debugging
- **Handle errors appropriately** - Don't catch if you can't handle

---

## Documentation Rules

### Code Documentation
- **Document public APIs** - Every exported function, class, interface
- **Update docs when code changes** - Stale docs are worse than no docs
- **Use JSDoc/TSDoc** - Standard documentation format
- **Include examples** - Show how to use complex functionality

### README.md
- **Keep updated** - README should reflect current state
- **Include setup instructions** - New developers should be able to start
- **Document dependencies** - List required tools and versions
- **Add troubleshooting** - Common issues and solutions

---

## Testing Rules

### Test Requirements
- **Test new features** - Every new feature needs tests
- **Test bug fixes** - Add test to prevent regression
- **Test edge cases** - Don't just test the happy path
- **Keep tests maintainable** - Tests should be readable and simple

### Test Organization
- **Mirror source structure** - Tests should follow src/ organization
- **Descriptive test names** - Test name should describe what it tests
- **One assertion per test** - Or at least one logical concept
- **Setup and teardown** - Clean up after tests

---

## Security Rules

### General Security
- **Never commit secrets** - Use environment variables
- **Validate all input** - Don't trust user data or external APIs
- **Sanitize output** - Prevent XSS, injection attacks
- **Use security headers** - CSP, CORS, etc.
- **Keep dependencies updated** - Patch known vulnerabilities

### Electron-Specific Security
- **Enable context isolation** - Always set `contextIsolation: true`
- **Disable node integration** - Set `nodeIntegration: false` in renderer
- **Use preload scripts** - Only expose needed APIs via `contextBridge`
- **Validate IPC messages** - Never trust renderer process data
- **Set CSP headers** - Restrict what renderer can load

---

## File Organization Rules

### Naming Conventions
- **Files**: `camelCase.ts` for utilities, `PascalCase.tsx` for components
- **Directories**: `kebab-case/` or `camelCase/` (be consistent)
- **Constants**: `UPPER_SNAKE_CASE`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`

### Project Structure
- **Group by feature** - Not by file type
- **Colocate related files** - Keep components, tests, styles together
- **Separate concerns** - UI, business logic, data access in different layers
- **Shared code** - Put in `shared/` or `common/` directory

---

## Review & Iteration

These rules are living guidelines. They should:
- **Evolve with the project** - Update as needs change
- **Be discussed** - Question rules that don't make sense
- **Be enforced** - Use linters, pre-commit hooks, CI checks
- **Be taught** - Help new contributors understand the why

---

**Last Updated**: 2026-01-31
