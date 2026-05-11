# Research Workbench Phase 6 Agent Signal Review

## Scope

Phase 6 changes the Agent role for the research workbench into a structured signal reviewer. The reviewer explains, challenges, and audits rule-generated signals; it does not create technical signals or provide transaction instructions.

## Changes

- Added `agent_decision_log` table.
- Added review prompt guardrails.
- Added structured review module with:
  - `upgrade | keep | downgrade | reject`
  - `low | medium | high` confidence
  - bull points, bear points, risk flags, missing data, and review summary
- Added default conservative reviewer for API use without a live LLM.
- Added API routes:
  - `POST /api/signals/{signal_id}/agent-review`
  - `GET /api/agent-reviews/{review_id}`
- Added tests for prompt constraints, structured JSON persistence, and API create/fetch flow.

## Verification

- `.venv/bin/ruff check tradingagents tests`
- `.venv/bin/pytest tests -q`
- `npm run build`

## Notes

- The reviewer includes a guard against prohibited transaction wording in structured outputs.
- A model-backed reviewer can be wired later by passing an LLM callable into `review_signal`.
