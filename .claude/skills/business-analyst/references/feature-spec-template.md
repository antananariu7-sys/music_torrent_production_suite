# Feature Spec Template

Use this template to produce the final feature spec document. Adapt sections as needed — skip sections that don't apply, add sections if the feature demands it.

```markdown
# Feature: [Feature Name]

## Overview
[1-2 sentence summary of what this feature does and why it matters]

## User Problem
[What pain point or need does this address? Why would the user want this?]

## User Stories
- As a [user type], I want to [action] so that [benefit]
- ...

## Proposed UX Flow

### Entry Point
[How does the user access this feature? New tab? Button? Menu item?]

### Step-by-Step Flow
1. [First user action]
2. [System response]
3. [Next user action]
...

### Key Screens / States
- **[Screen/State name]**: [Description of what the user sees and can do]
- ...

## Data Model Changes
[New entities, modified fields, or new relationships. Reference existing entities from domain-context.md where applicable]

| Entity | Field | Type | Description |
|--------|-------|------|-------------|
| ... | ... | ... | ... |

## Edge Cases & Error States
- [Edge case 1]: [How to handle]
- [Edge case 2]: [How to handle]
- ...

## Acceptance Criteria
- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]
- ...

## Open Questions
- [Anything still unresolved after the Q&A session]

## Out of Scope
- [Things explicitly excluded from this feature]

## Dependencies
- [Other features, services, or data this depends on]
```
