# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Job seekers running the app on their own machine. They upload a CV, review public listings against that profile, draft application emails, and send only after explicit approval. [inferred from README and existing routes]

## Product Purpose

Discover public job listings, score them against a structured candidate profile, and send applications through SMTP after the user reviews the email. Success is a truthful match list and a send that never happens by accident. [inferred]

## Positioning

Local-first: data and API keys stay on the machine. Job Match Score is profile-to-job similarity, never a hiring probability. LinkedIn and Indeed are not scraped. AI is optional; templates and profile edits work without it. Auto-send is off until Settings enables it.

## Operating Context

Desktop browser at a desk. Typical loop: upload CV → run search → scan matches → generate email → edit → approve → send. Settings holds SMTP, AI keys, email template, and auto-send. Demo seed data is labeled as demo.

## Capabilities and Constraints

- Next.js web app + Fastify API + PostgreSQL
- Public sources only: Remotive, RemoteOK, Arbeitnow, RSS, Greenhouse
- Applications require approval unless auto-send is on; daily limits apply
- No n8n/Zapier/Make
- Dropdowns must be custom components, not native `<select>`
- Visual direction: quieter operate UI (Impeccable quieter + UIZZE anti-ui-slop)

## Brand Commitments

Name: Job Hunter. Voice: plain, cautious about sending, explicit that Match Score is not a hire chance. No marketing claims beyond what the app does.

## Evidence on Hand

Seeded demo jobs and a demo candidate profile in the database. Screenshots of the incumbent zinc/blue dashboard. No customer logos, testimonials, or photography. Do not fabricate employers or outcomes.

## Product Principles

1. Sending is a protected action; the UI should make that obvious.
2. Match Score is a number with a definition, not a trophy.
3. Editing profile and email is first-class, with or without AI.
4. The tool recedes; the jobs, scores, and letters are the content.
5. Safety copy stays factual: what is scraped, what is not, what auto-send does.

## Accessibility & Inclusion

Keyboard-operable custom dropdowns, visible focus, body text contrast ≥4.5:1. [inferred from craft floor and dropdown requirement]
