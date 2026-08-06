# ADR 0006 — All-in-one container hosting instead of serverless

- Status: accepted
- Date: 2026-07-21

## Context / Problem

The tool needs (a) a web app reachable from anywhere — including iPad — via browser, and
(b) a daily batch job that fetches several feeds and enriches new items via LLM.
Serverless platforms (e.g. Vercel) offer the smoothest Next.js deploy, but enforce
per-function time limits, which forces the daily batch into chunks.

## Decision

Deployment as a **single always-on container** on **Railway** (app + cron job +
managed Postgres in one place). The target operating model is cloud (reachable from
anywhere); the same codebase runs locally as an interim solution.

## Alternatives

- **Serverless (Vercel + Vercel Cron)**: smoothest frontend deploy, but
  function time limits require batch chunking. Rejected for the daily batch.
- **Self-hosted at home (NAS/Raspberry Pi)**: no external costs, but operational and
  reachability overhead. Rejected.

## Consequences

- No serverless timeout handling needed for the scrape/LLM batch.
- Cost dominated by the fixed hosting price (Hobby tier ~$5/month), not by the work;
  LLM costs stay in the cents range per day.
- One box is "always on" (instead of spinning up on demand) — negligible for
  a single user.
