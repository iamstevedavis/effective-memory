# ARCHITECTURE.md

## Tech stack
Define and maintain the core stack in this section as the source of truth:
- Runtime(s)
- Framework(s)
- Data store(s)
- Infrastructure/deployment model
- Testing and CI tooling

## Key patterns
Document the patterns we intentionally use:
- Module boundaries and ownership
- API design conventions
- State/data flow rules
- Error handling and observability approach

## Directory structure
```text
.
├─ PRODUCT.md
├─ ARCHITECTURE.md
├─ DECISIONS.md
├─ WORKFLOW.md
└─ src/
```

## Don't do X
- Don't add new frameworks without a documented decision
- Don't bypass established boundaries “just this once”
- Don't introduce hidden coupling across modules
- Don't optimize prematurely without evidence
