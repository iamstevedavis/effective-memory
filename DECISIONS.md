# DECISIONS.md

Decision log to capture architecture/product calls and why they were made.

## Format

- Date: YYYY-MM-DD
- Decision: short title
- Why: rationale and constraints

---

## Log

- Date: 2026-02-27
  Decision: Use lightweight markdown docs for alignment
  Why: Fast to edit, easy to review, low process overhead. Keeps intent, architecture, and workflow explicit without heavy tooling.

- Date: 2026-02-27
  Decision: Require explicit decision logging for architectural changes
  Why: Prevent re-litigating the same choices every week and reduce AI-driven drift in architecture over time.

- Date: 2026-02-27
  Decision: Build as a SaaS web application (not a library/framework)
  Why: The product is a revenue-generating automation tool for local businesses. It requires onboarding, dashboards, approval flows, and scheduling — not just reusable code.

- Date: 2026-02-27
  Decision: Use Node.js + TypeScript + Next.js
  Why: Strong ecosystem for API integrations, background jobs, and rapid product iteration. Type safety helps maintain architectural discipline as the codebase grows. Next.js supports both UI and API in one deployable unit.

- Date: 2026-02-27
  Decision: Use Postgres as primary datastore
  Why: Relational model fits businesses, reviews, drafts, and scheduling states well. Strong consistency guarantees and mature tooling. Avoid premature NoSQL complexity.

- Date: 2026-02-27
  Decision: Use Redis + BullMQ for background jobs
  Why: Review ingestion, quote extraction, image rendering, and scheduling are asynchronous tasks. A job queue ensures retries, observability, and reliability.

- Date: 2026-02-27
  Decision: Deploy MVP via Docker on existing VPS
  Why: Lowest cost, full control, fast iteration. Infrastructure simplicity outweighs managed-service benefits at early stage.

- Date: 2026-02-27
  Decision: Scheduler-first publishing strategy
  Why: Direct platform integrations (Instagram, X, Facebook, etc.) are complex and policy-heavy. Integrating with a scheduler (e.g., Buffer) reduces integration surface area and accelerates MVP delivery.

- Date: 2026-02-27
  Decision: Human-in-the-loop approval required for MVP
  Why: Protect brand voice and reduce risk. Auto-posting introduces reputational and legal risk. Manual approval builds trust and reduces AI hallucination exposure.

- Date: 2026-02-27
  Decision: PR-only development workflow (no direct pushes to main)
  Why: Prevent accidental architecture drift or destructive changes from AI agent. Maintain human oversight and review discipline.
