---
trigger: model_decision
description: "When and how to update Dit Windsurf rules. Read when something in the codebase does not match what the rules say."
---

> LIVING DOCUMENT — this file itself must be updated if the maintenance process changes.

# Rule Maintenance — dit-worker

## When to update rules

**UPDATE `.windsurf/rules/coding-standards.md`** when:
- A new pattern is established that should be followed everywhere
- A library introduces a breaking change that alters how we use it
- A code review surfaces a recurring mistake worth preventing

**UPDATE `.windsurf/rules/architecture.md`** when:
- A new provider is added
- The job flow changes
- A Redis key namespace is added or changed

**UPDATE `.windsurf/rules/decisions.md`** when:
- A technology choice is made (add ADR with date, decision, rationale, consequence)
- An existing choice is reversed (update the existing ADR, do not delete it)

**UPDATE `AGENTS.md`** when:
- A hard constraint changes (e.g., a library is removed or replaced)
- A responsibility boundary between services shifts

**UPDATE `.windsurf/skills/*.md`** when:
- A step in a recurring task changes
- A new required step is discovered

## ADR format

```
## ADR-NNN — Title
Date: YYYY-MM-DD
Decision: what was chosen
Rationale: why (what alternatives were considered)
Consequence: what changes as a result
```

## How to update

Ask Cascade: "update .windsurf/rules/decisions.md — we decided to [X] instead of [Y] because [Z]"

Cascade will add the ADR, link the consequence to any affected coding-standards rules, and flag any existing code that contradicts the new decision.
