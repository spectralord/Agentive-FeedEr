# ADR 0001 — Curated sources instead of open web scraping

- Status: accepted
- Date: 2026-07-21

## Context / Problem

The tool is meant to collect AI news. The original idea included "scraping the general
web". However, open web scraping and open web search are expensive, unreliable
(every page is different, layouts break), maintenance-intensive, and the main source of
noise and hallucination — in direct contradiction to the goal of *reliably* knowing what
is new and state of the art.

## Decision

The MVP sources content exclusively from **curated, structurally fetchable
sources** (RSS/Atom, official changelogs, HN/Reddit APIs, newsletters). Individual
site-specific scrapers and open web search are deliberately deferred and
only added per source when there is concrete demand.

## Alternatives

- **Open web scraping / web search from the start**: more powerful, but unreliable,
  expensive, and noise-heavy. Rejected.
- **Mixed (curated + targeted scraping)** from the start: unnecessary complexity, since
  ~80% of the focus comes from a few high-quality feeds.

## Consequences

- Reliable, cheap, low-maintenance ingestion.
- A **source registry** is needed, in which sources are declared.
- Topic coverage is limited by source selection — acceptable, since curation is
  desired. New sources can be added additively.
