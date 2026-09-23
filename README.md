# Two for Tonight

A movie/TV matchmaker for two people who can never agree what to watch — mood + language + rating prefs from both partners, swipe on a shared shortlist, get a match with exactly where to stream it in India.

This doc is everything you need to get it running, in order.

## 1. What you're deploying

- **Next.js 14** app (App Router, TypeScript, Tailwind) — frontend + API routes in one project
- **Supabase** — Postgres database + realtime (so both phones update instantly, no polling)
- **Gemini (Google)** — turns both partners' preferences into a search brief, and refines it if round 1 has no match
- **TMDB** — the title catalogue, posters, ratings, runtimes
- **RapidAPI (Streaming Availability)** — which Indian OTT platform each match is on right now

Nothing runs "for free forever" here — TMDB is free, but Gemini, RapidAPI, and Supabase all have either a paid tier or a metered free tier. See costs at the bottom.

## 2. Get your API keys (do this first)

1. **Gemini (Google AI Studio)** → https://aistudio.google.com/apikey → create a key. This is `GEMINI_API_KEY`. Google's Gemini keys normally start with `AIzaSy...` — if yours looks different, double check it's a Generative Language API key and not some other Google credential before relying on it.
2. **TMDB** → https://www.themoviedb.org/signup → once logged in, go to Settings → API → request an API key (choose "Developer"). You'll get both a v3 key and a v4 **Read Access Token** — grab the v4 token, that's `TMDB_READ_ACCESS_TOKEN`.
3. **RapidAPI (OTT Details, by GoX-ai)** → https://rapidapi.com/gox-ai-gox-ai-default/api/ott-details → sign up, subscribe to the free tier, copy the key from the "X-RapidAPI-Key" field. That's `RAPIDAPI_KEY`.
4. **Supabase** → https://supabase.com/dashboard → New project. Once created, go to Project Settings → API and grab:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (reveal it) → `SUPABASE_SECRET_KEY` — **never expose this to the browser, it's used server-side only**

## 3. Set up the database

1. In the Supabase dashboard, open the **SQL Editor**.
2. Paste in the entire contents of `supabase/schema.sql` from this project and run it.
3. This creates every table (sessions, preferences, round pools, swipes, ratings, partner history), turns on row-level security, and adds `sessions`/`swipes` to the realtime publication so the app gets instant updates.

## 4. Run it locally

```bash
npm install
cp .env.example .env.local
# open .env.local and paste in the keys from step 2
npm run dev
```

Open http://localhost:3000. To actually test the two-partner flow, open the QR link it gives you in a second browser (or your phone, if you're on the same network and use your machine's local IP instead of localhost).

## 5. Deploy it

The easiest path is **Vercel** (built by the same team as Next.js, zero config needed):

1. Push this project to a GitHub repo.
2. Go to https://vercel.com/new, import the repo.
3. In the Vercel project's Environment Variables settings, add every variable from `.env.example` with your real values — **including** setting `NEXT_PUBLIC_APP_URL` to your actual deployed URL (e.g. `https://two-for-tonight.vercel.app`) once you know it, since the QR code is built from this.
4. Deploy. Redeploy once after setting `NEXT_PUBLIC_APP_URL` if you set it after the first deploy, so the QR links point to the right place.

## 6. How the flow actually works, end to end

1. Partner A opens the app, fills the preference form, hits Continue → this creates a session row and Partner A's preference row.
2. A QR code appears (built from `NEXT_PUBLIC_APP_URL/session/<id>`). A shares it — scan, or the "Send to their phone" button uses the device's native share sheet to send the QR as an image to WhatsApp/etc., with a plain link as the fallback if `navigator.share` isn't available.
3. Partner B opens the link, is assigned role B, fills the same form independently (B never sees A's answers — they're just two separate rows in `session_partners`).
4. The moment both have submitted, the server calls Gemini with both full preference profiles (checkboxes **and** the free-text mood lines) and gets back a structured search brief (Gemini's `responseSchema` enforces the JSON shape directly, no parsing-out-of-prose needed). That brief drives a TMDB `/discover` query for 30 titles, stored as the round's shared pool.
5. Both phones — connected via Supabase realtime, not polling — flip to the swipe screen at the same moment. Card order is shuffled independently per partner client-side.
6. Every swipe is written to `swipes`. After each **right** swipe, the server checks whether the other partner has also swiped right on that exact title — if so, it's an instant match, and both screens flip to the match screen simultaneously via the realtime subscription.
7. If both partners finish all 30 cards with no mutual right-swipe, the server calls Gemini again — this time with both partners' actual right/left swipe lists from that round — to refine the brief, and pulls a fresh, deduplicated pool of 30 for round 2.
8. If round 2 also ends with no match, both screens show the top 5 titles ranked by combined right-swipe count, and either partner can tap one to lock it in as the pick.
9. The match screen calls RapidAPI to show exactly which Indian OTT platforms have it right now, each with a direct link. Partners can optionally leave a 1–5 rating afterward — that rating, plus every swipe, is saved to `partner_history` and quietly informs the search brief the *next* time this same pair (by device ID) starts a session together.

## 7. Known simplifications, worth knowing about before you rely on this

- **Partner identity is device-based, not account-based.** A UUID is generated into `localStorage` the first time someone uses the app on a given browser/device. This is what lets the "watched and enjoyed together" personalization work across sessions, but it means clearing browser storage or switching devices loses that history. Adding real auth (e.g. Supabase Auth with phone/email) would be the natural next step if you want history to survive a device change.
- **Resuming mid-swipe isn't handled.** If someone closes the tab mid-deck, reopening currently starts them back at whatever `session.status` says — since a round's swipes are already saved, this is safe from a data standpoint, but the UI doesn't yet re-hydrate "you were 12 cards into round 1" — it'll re-render the full deck. Worth fixing if flaky mobile connections are a concern.
- **RapidAPI's OTT Details free tier has its own request cap (check the current limit on its pricing tab — it's changed over time). Each match triggers one lookup, cached for an hour per title. Fine for testing; budget for a paid tier before a real launch.
- **The `9+` rating filter combined with a specific language and era can legitimately return zero titles** — the pool-building route relaxes the rating floor by one point and retries once in that case, but it's worth knowing that's a real edge case with the current catalogue sizes, not a bug.

## 8. Rough monthly cost at low volume (a few dozen sessions/month)

- Vercel: free (Hobby tier covers this comfortably)
- Supabase: free tier is enough until you're well past hobby scale
- TMDB: free, no meaningful limits for this use case
- Anthropic: pennies per session — two short structured-output calls per session (occasionally three, if round 2 is needed)
- RapidAPI: free tier covers light testing; check OTT Details' current pricing tab for the exact request cap and upgrade if you expect volume

## Project structure

```
app/
  page.tsx                    landing + Partner A's preference form
  session/[id]/page.tsx       the whole shared session experience (orchestrator)
  api/session/...              all backend routes (see inline comments per file)
src/
  components/                 PreferenceForm, SwipeDeck, QRShare, MatchCelebration, etc.
  lib/
    gemini.ts                  the two Gemini calls: brief generation + round refinement
    tmdb.ts                   TMDB discover + detail fetching
    ott.ts                    RapidAPI Indian streaming availability
    matching.ts               mutual-match detection, combined scoring
    supabase.ts                browser client (anon) vs server client (service role)
    types.ts                  shared TypeScript types
supabase/schema.sql            run this once in the Supabase SQL editor
```
