# AGENTS.md

## Project mission

This repository is developed with Codex assistance.

Codex should help implement features, fix bugs, improve tests, refactor safely, and create reviewable pull requests. All work must be small, verifiable, and easy to review.

User-facing explanations, task summaries, and PR descriptions should be written in Chinese unless the user explicitly asks for English.

---

## Core working principles

1. Understand before changing code.
2. Prefer small, focused changes.
3. Do not rewrite unrelated files.
4. Do not introduce new dependencies unless clearly justified.
5. Follow existing project patterns before inventing new ones.
6. Keep behavior backward-compatible unless the task explicitly requires a breaking change.
7. Never commit secrets, tokens, credentials, private keys, or production configuration.
8. Before marking work complete, run relevant checks and summarize the results.
9. If a command fails, explain the failure, investigate, and either fix it or clearly report why it cannot be fixed in this task.
10. When uncertain, choose the safest minimal implementation and document the assumption.

---

## Repository skills

This repository may contain reusable Codex skills in:

```text
.agents/skills/
```

Use repository skills whenever relevant.

Recommended Superpowers skill usage:

- For any non-trivial task, first use `using-superpowers`.
- For product or feature design, use `brainstorming`.
- For implementation planning, use `writing-plans`.
- For coding work, use `executing-plans`.
- For behavior changes, use `test-driven-development` when practical.
- For bugs, use `systematic-debugging`.
- Before completion, use `verification-before-completion`.
- Before creating a final PR, check whether `requesting-code-review` or `finishing-a-development-branch` applies.

Do not skip required confirmation gates from Superpowers unless the user explicitly asks for a fast prototype or one-shot implementation.

---

## Standard task flow

For feature work:

1. Read:
   - `README.md`
   - this `AGENTS.md`
   - relevant files under `docs/`
   - package/dependency files
   - existing implementation patterns

2. Clarify the scope:
   - What is being added or changed?
   - What is explicitly out of scope?
   - Which files/modules are likely affected?
   - What assumptions are being made?

3. Create a brief implementation plan before coding.
4. Implement the smallest useful version.
5. Add or update tests when behavior changes.
6. Run the relevant verification commands.
7. Summarize:
   - What changed
   - Why it changed
   - Files modified
   - Test/build/lint results
   - Risks or follow-up items

For bug fixing:

1. Reproduce or reason about the bug first.
2. Identify the root cause.
3. Make the smallest fix.
4. Add a regression test when possible.
5. Verify the fix.
6. Explain the root cause and the fix in the final summary.

For refactoring:

1. Do not change behavior unless explicitly requested.
2. Keep each refactor focused.
3. Preserve public APIs.
4. Run tests before and after if practical.
5. Clearly state that the change is behavior-preserving.

---

## Commands

Use the commands that match the repository. Detect the package manager and framework before running commands.

Common Node.js commands:

```bash
npm install
npm run lint
npm test
npm run build
```

If the project uses pnpm:

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

If the project uses yarn:

```bash
yarn install
yarn lint
yarn test
yarn build
```

If the project uses Python:

```bash
python -m pytest
python -m ruff check .
python -m mypy .
```

If a command does not exist, do not invent one. Inspect `package.json`, `pyproject.toml`, `Makefile`, `README.md`, CI workflows, or other project files to find the correct command.

---

## Git and PR rules

1. Work on a new branch for each task.
2. Keep commits focused and meaningful.
3. Do not include unrelated formatting churn.
4. Do not commit generated files unless they are expected by the project.
5. Before opening a PR, inspect the diff.
6. PR descriptions should include:
   - Summary
   - Key changes
   - Verification performed
   - Risks
   - Follow-up items, if any

Suggested PR description format:

```md
## Summary

- ...

## Changes

- ...

## Verification

- [ ] lint
- [ ] test
- [ ] build

## Risks

- ...

## Notes

- ...
```

---

## Code quality rules

- Prefer readable code over clever code.
- Keep functions small and focused.
- Reuse existing utilities and patterns.
- Handle errors explicitly.
- Avoid broad catch-all error handling unless justified.
- Avoid global state unless the project already uses it.
- Avoid hidden side effects.
- Avoid large migrations unless specifically requested.
- Maintain type safety where applicable.
- Add comments only when they explain non-obvious decisions.

---

## Testing rules

Add or update tests when:

- A new feature is added.
- A bug is fixed.
- Business logic changes.
- Public API behavior changes.
- Edge cases are introduced.

Do not add superficial tests that only assert implementation details.

Prefer testing observable behavior.

If the project has no test framework, do not introduce a large testing stack without approval. Instead, propose a minimal test strategy first.

---

## Security rules

Never expose or commit:

- API keys
- access tokens
- private keys
- passwords
- cookies
- session values
- production database URLs
- personal data
- internal credentials

Before touching authentication, authorization, payments, data access, or file handling code, explicitly check for security risks.

For any user input:

- Validate input.
- Sanitize output where relevant.
- Avoid injection vulnerabilities.
- Avoid unsafe file path handling.
- Avoid logging sensitive data.

---

## Dependency rules

Before adding a dependency:

1. Check whether the project already has an equivalent dependency.
2. Prefer standard library or existing utilities.
3. Justify why the dependency is needed.
4. Consider maintenance, security, bundle size, and licensing.
5. Update lockfiles consistently.

Do not add dependencies for trivial utilities.

---

## Documentation rules

Update documentation when:

- Setup steps change.
- Commands change.
- Public behavior changes.
- New environment variables are introduced.
- New workflows are added.

Documentation should be practical and concise.

---

## Environment and configuration

Do not assume production credentials are available.

Use examples like:

```bash
.env.example
```

when documenting environment variables.

Never create or modify real `.env` files unless explicitly requested.

---

## Completion checklist

Before saying the task is complete, verify:

- [ ] The requested scope is implemented.
- [ ] Unrelated files were not changed.
- [ ] Tests were added or updated when needed.
- [ ] Relevant lint/test/build commands were run, or skipped with a clear reason.
- [ ] The final diff was reviewed.
- [ ] Risks and assumptions are documented.
- [ ] No secrets or private data were committed.

Final response should include:

1. Summary of changes
2. Files changed
3. Verification results
4. Risks or follow-up items
