<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.0.1
  Modified principles: None (initial population from template)
  Added sections:
    - Core Principles: I. Specification-First
    - Core Principles: II. Test-Driven Development (NON-NEGOTIABLE)
    - Core Principles: III. MVP-First Delivery
    - Core Principles: IV. Independent Story Delivery
    - Core Principles: V. Documentation as Code
    - Development Workflow
    - Quality Gates
    - Governance
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md  ✅ — Constitution Check gates align with Quality Gates section
    - .specify/templates/spec-template.md  ✅ — User story structure aligns with Principles III & IV
    - .specify/templates/tasks-template.md ✅ — TDD task ordering aligns with Principle II; story independence aligns with Principle IV
    - .specify/templates/commands/*.md     ✅ — No templates/commands directory found; extension commands verified (no outdated agent-only references)
  Deferred items:
-->


# shogi Constitution

## Core Principles

### I. Specification-First

Every feature MUST begin with a formal specification document (`spec.md`) before any
implementation work starts. Specifications MUST define user scenarios with acceptance
criteria, measurable success outcomes, and functional requirements. Code merged to the
main branch without an approved spec is a compliance violation.

**Rationale**: Prevents scope creep, ensures shared understanding among all contributors,
and creates an auditable record of intent for every feature. Specs written after the fact
are not compliant — discovery and design happen in the spec, not in the code.

### II. Test-Driven Development (NON-NEGOTIABLE)

Tests MUST be written and confirmed failing before implementation code is written. The
Red-Green-Refactor cycle is mandatory for all non-trivial logic:

- Write the test → confirm it fails → implement → confirm it passes → refactor.
- Contract tests and integration tests MUST be authored in the task phase and executed
  as the first implementation tasks.
- Features shipped without test coverage MUST include explicit written justification
  in the plan's Complexity Tracking table.

**Rationale**: Catches design problems early, documents intent as executable specification,
and enables safe refactoring throughout the project lifecycle. Skipping TDD is not a
time-saving measure — it defers cost with compounding interest.

### III. MVP-First Delivery

Each feature MUST identify a P1 (highest-priority) user story that constitutes the
Minimum Viable Product. P1 functionality MUST be:

- Completely implemented,
- Independently validated and demo-ready,

before any P2+ user story work begins. Beginning P2 work before P1 is validated and
accepted is a governance violation requiring explicit justification in the plan.

**Rationale**: Maximises early value delivery, limits work-in-progress, and ensures
each development iteration produces a shippable increment the team and stakeholders can
evaluate before committing further effort.

### IV. Independent Story Delivery

Each user story MUST be independently implementable, testable, and deployable. A user
story that cannot be demonstrated or validated without another story being complete MUST
be flagged for redesign before development begins. Cross-story dependencies that prevent
independent validation are prohibited without explicit documentation of why the dependency
cannot be eliminated.

**Rationale**: Enables parallel development across team members, reduces integration risk,
and allows stakeholders to review working software at each story boundary rather than
waiting for a "big bang" delivery.

### V. Documentation as Code

All specification artifacts (`spec.md`, `plan.md`, `tasks.md`, `research.md`,
`data-model.md`, contract files) are first-class project deliverables. They MUST be:

- Committed in the same feature branch as the code they describe.
- Kept current throughout the feature lifecycle — stale docs are treated as defects.
- Free of unexplained placeholder tokens before the branch is merged.

**Rationale**: Keeps intent and implementation in sync, supports onboarding, and enables
retrospective analysis of design decisions. Documentation drift causes the same category
of bugs as out-of-date tests.

## Development Workflow

Feature development MUST follow the **Speckit SDD pipeline** in order:

| Step | Command | Artifact | Gate |
|------|---------|----------|------|
| 1. Specify | `/speckit-specify` | `specs/###-name/spec.md` | User approves spec before proceeding |
| 2. Plan | `/speckit-plan` | `specs/###-name/plan.md` + supporting docs | Constitution Check MUST pass |
| 3. Tasks | `/speckit-tasks` | `specs/###-name/tasks.md` | Tasks ordered by story priority (P1 first) |
| 4. Implement | `/speckit-implement` | Source code + tests | Tasks completed in story-priority order |
| 5. Checklist | `/speckit-checklist` | Acceptance checklist | All gates passed before merge |

**Branch naming**: `###-feature-name` with sequential numbering
(e.g., `001-user-auth`, `002-data-export`). Branch numbers are assigned at spec creation.

**Commit discipline**:
- Each commit MUST reference a task ID (e.g., `T012`).
- Commits MUST be scoped to a single logical change.
- Commits grouping unrelated tasks or crossing story boundaries are prohibited.

**AI integration**: This project uses Claude as the AI agent (Speckit v0.8.13, integration:
`claude`, scripting: PowerShell). Agent-specific guidance lives in `CLAUDE.md`.

## Quality Gates

### Constitution Check (at plan phase — re-check after Phase 1 design)

Before implementation begins, the plan's Constitution Check section MUST confirm all of:

- [ ] Feature has an approved `spec.md` with at least one independently testable user story
- [ ] P1 user story is clearly identified and constitutes a standalone MVP
- [ ] All user stories are independently testable and deliverable without cross-story dependencies
- [ ] Test tasks are listed before implementation tasks for every user story
- [ ] All specification artifacts are scoped to the feature branch

Failures MUST be documented in the plan's Complexity Tracking table with justification;
unresolved failures block implementation from starting.

### Merge Readiness

Before merging a feature branch to main, ALL of the following MUST be satisfied:

- [ ] All tasks in `tasks.md` are marked complete or explicitly deferred with justification
- [ ] Acceptance checklist (`/speckit-checklist`) passed with no open blocking items
- [ ] No unexplained placeholder tokens in any spec artifact (`spec.md`, `plan.md`, `tasks.md`)
- [ ] At least one integration test per user story exists and passes (when tests were requested)
- [ ] P1 user story has been independently demonstrated or validated

## Governance

This constitution supersedes all other project practices and conventions. In cases of
conflict, this document takes precedence. All contributors MUST read and acknowledge this
constitution before authoring their first feature spec.

**Amendment procedure**:

1. Propose the change as a pull request that modifies `.specify/memory/constitution.md`.
2. Increment the version number per the versioning policy below.
3. Update the Sync Impact Report HTML comment at the top of this file.
4. Obtain approval from at least one other contributor (or the project owner for solo projects).
5. Update all templates and documents flagged in the Sync Impact Report before merging.

**Versioning policy**:

- **MAJOR** (`X.0.0`): Principle removals, redefinitions, or backward-incompatible governance changes.
- **MINOR** (`x.Y.0`): New principle or section added, or materially expanded guidance.
- **PATCH** (`x.y.Z`): Clarifications, wording improvements, typo fixes, non-semantic refinements.

**Compliance review**: Each plan's Constitution Check section serves as the per-feature
compliance review. Recurring failures across features indicate a need for constitution
amendment rather than repeated exception-granting.

**Runtime guidance**: See `CLAUDE.md` for AI-agent-specific runtime instructions. The
`CLAUDE.md` file is complementary to this constitution and does not supersede it.

**Version**: 1.0.1 | **Ratified**: 2026-05-23 | **Last Amended**: 2026-05-23
