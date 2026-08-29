# SnapQuest

Party photo bingo and a four-cut keepsake: AI deals each guest a different 3x3 photo-mission bingo board, and when the party ends, the board becomes a personalized four-cut ticket.

Guests join by QR on the mobile web — no app install, no login. Photos are auto-verified by vision AI, captioned, and rendered on a live photo wall. After the party, the room link doubles as a shared album.

## Getting started

```bash
npm install
cp .env.example .env.local   # then set GEMINI_API_KEY
npm run dev
```

Without an API key the AI routes still respond — every one of them falls back to preset data rather than failing.

## AI endpoints

All five generative calls are isolated under `src/app/api/ai/`, with shared clients, prompts, and fallbacks in `src/lib/ai/`.

| Route | Purpose | Call budget |
|---|---|---|
| `avatar` | Character illustration and MC intro line from a selfie or a 3-line bio | once per guest |
| `bingo-board` | Nine "shoot together" missions, crossed against the other guests in the room | once per guest |
| `verify-photo` | Vision check that a photo matches its mission, plus an auto caption | once per photo |
| `mc-reaction` | One-line MC reaction when a photo lands on the wall | once per photo |
| `titles` | Awards for everyone, generated in a single batch | once per party |

Two rules hold across all of them: a fixed call ceiling per guest or per photo, and a preset fallback on failure or timeout so the flow never stalls.

## Planning docs

- [Feature spec, v2](docs/SnapQuest_기능명세서_v2.md) — nine features with acceptance criteria, GTM, and business model
- [User flow, v2](docs/SnapQuest_유저플로우_v2.md) — end-to-end flow diagram (mermaid) with fallback paths

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · `@google/genai` · Supabase (Realtime, Storage) · Vercel
