# CLAUDE.md — Technical Guide & Execution Constraints

## 1. Core Commands (Cheat Sheet)
- **Development Server:** `npm run dev`
- **Production Build:** `npm run build`
- **Linting:** `npm run lint`
- **Database Migration:** `npx drizzle-kit push` (or `npx drizzle-kit generate` / `migrate`)
- **Execute All Tests:** `npm run test`
- **Execute Single Test:** `npx vitest run src/components/ReelDetail.test.tsx` (Replace path)

## 2. Model & Execution Restrictions
- **No Subagents:** Standardize strictly on **Claude 5 Sonnet** (or current primary single-agent). Do not delegate tasks to subagents. Execute all implementations directly in this session.
- **Forced Script Blocklist:** You are EXPLICITLY FORBIDDEN from running backend automated loops or data syncs:
  * Do NOT run `npm run pipeline`
  * Do NOT run `npm run enrich`
  * Do NOT run `npm run sync`
  If verification is required, use mock unit tests. Real data automation runs must only be executed by the user via the Admin UI.

## 3. Feature Development & Design Guidelines
- **Draft Schema First:** If a new feature requires state or persistent records, write the Drizzle schema changes first. Compile and run migrations before writing backend logic or UI.
- **Avoid Over-Abstraction:** Do not build task queues, intermediate event dispatchers, or complex state managers unless a single, inline implementation has been proven to fail under load. Two concrete use cases make a pattern; one makes a feature.
- **Deterministic UI Rendering:** Never hide core interactive views or buttons (e.g., action items, tabs, lists) behind non-deterministic AI properties or classification fields. If data has not yet been processed by an LLM, show a functional, manually editable fallback state.
- **Strict Tailwind v4 Usage:** Keep styling bound entirely to the central `@theme` design tokens in `src/app/globals.css`. Never use raw, hardcoded color literals (e.g., `zinc-500`) in markup files.

## 4. Development & Token Optimization Workflow
- **Front-Loaded Reading:** Read all required files for a task once at the start. Do not incrementally search or re-read files across multiple turns.
- **Granular Verification:** 
  * Documentation-only edits = No testing/linting runs.
  * Single-file edits = Test only that specific file's tests.
  * Full typecheck/linter runs are reserved strictly for right before a git commit/push.
- **Batching:** Accumulate related changes across files. Do not commit or verify after every single-line edit; batch them into singular logical checkpoints.

## 5. Persona & Communication Style
- **Tone:** Direct, unvarnished, objective. 
- **Formatting:** Bulleted direct critiques, concrete Before/After code blocks, and immediate recommendations. No introductory or closing conversational filler.