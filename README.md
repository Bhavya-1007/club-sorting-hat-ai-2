# Club Sorting Hat

Release behavior and deployment steps: [RELEASE.md](RELEASE.md). Groq outages and exhausted AI capacity now return clearly labeled deterministic results; paid AI is disabled if shared production controls are missing.

The active provider is Groq, using `https://api.groq.com/openai/v1/chat/completions` and `GROQ_MODEL=openai/gpt-oss-20b`. The `openai/` model namespace identifies the model publisher; requests and the API key go to Groq. The backend no longer reads OpenAI credentials. [Groq documents this model's structured-output support](https://console.groq.com/docs/structured-outputs).

Groq token-per-minute limits can reject rapid repeated quizzes. The UI reports this explicitly; wait a minute before retrying. The live smoke script spaces its synthetic requests by 65 seconds and may still need more time if another client uses the same account. It makes real API calls and consumes quota. Model ratings are estimates; ties remain possible and are not broken with invented precision.

Groq can occasionally generate a response that fails schema or answer-to-evidence validation. The server provides allowed answer IDs for each fact and retries those failures at most once within the original 25-second timeout, never accepts rejected output, and never retries authentication or quota errors. One admitted quiz request can therefore use up to two provider calls; the daily request cap applies to admitted quizzes.

A vanilla HTML/CSS/JavaScript quiz recommending real University Park student organizations. The original navy-and-gold interface, ten questions, hat animations, navigation and browsing remain. A Vercel function supplies real Groq ranking when configured, or explicitly labeled non-AI tag matching without a key.

Final audit: 108 browsable listings, 104 recommendation-eligible, four held. See [FINAL-AUDIT.md](FINAL-AUDIT.md) for source/activity limitations, link checks and the public-beta gate.

## Run locally

Install Node.js 22 or newer. No production packages are required.

```powershell
node --env-file-if-exists=.env.local scripts/dev.mjs
```

Open http://127.0.0.1:3000 in your browser. Use this server rather than Python's static server: recommendations need the backend route. The server exposes only the five public frontend files, not secrets, tests or backend source.

For live AI, create a project API key at https://console.groq.com/keys with API billing enabled. A blank `.env.local` template has been created locally; if absent, copy `.env.example` to `.env.local`. Set `GROQ_API_KEY=your_actual_key` in that local file and keep `GROQ_MODEL=openai/gpt-oss-20b`. Never send it in chat, put it in frontend JavaScript, or commit it. Restart the server after configuration changes.

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Groq project API key with billing and model access. Empty means labeled non-AI matching. |
| `GROQ_MODEL` | Chat Completions API model supporting strict JSON Schema. Default: `openai/gpt-oss-20b`. |
| `UPSTASH_REDIS_REST_URL` | Shared Redis REST endpoint for deployed usage limits. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Redis credential. Required with the URL for paid AI on Vercel. |
| `AI_DAILY_REQUEST_LIMIT` | Global paid request cap per UTC day; default 100, maximum 1,000. |
| `PORT` | Optional local server port; default 3000. |

Key-enabled AI on Vercel fails closed if distributed rate limiting is missing. Local development uses a memory limiter. Limits are 10 recommendation requests per IP per 10-minute window, 8 KB request bodies, 28 candidates, 6,000 completion tokens (including reasoning), and a 25-second provider timeout. The browser allows 32 seconds; Vercel allows 40 seconds. Configure provider project budgets/alerts and Vercel firewall limits before a public launch. A shared UTC daily cap defaults to 100 admitted attempts (configurable with AI_DAILY_REQUEST_LIMIT, maximum 1,000). Failed attempts count; this is a request cap, not a dollar budget. Local counters reset on restart.

## Architecture

- `index.html`, `styles.css`, `app.js`: original frontend plus asynchronous recommendation requests, retry/cancellation, source links and privacy/mode notices.
- `questions.json`: original ten questions; IDs and option text define the API's accepted inputs.
- `clubs.json`: versioned curated catalog; 108 organizations sourced from Penn State publications and directories.
- `api/clubs.js`, `lib/catalog.js`, `lib/search.js`: paginated searchable catalog and bounded candidate retrieval.
- `scripts/import-catalog.mjs`: approved CSV, JSON or normalized API import, dry run and atomic updates.
- `api/recommendations.js`: POST endpoint, validation, request limits, sanitized errors and no-store responses.
- `lib/recommendations.js`: structured student profile, candidate retrieval, Groq Chat Completions API and output validation.
- `lib/rate-limit.js`: shared REST Redis limiter, with memory storage only for local/no-key use.
- `scripts/dev.mjs`: dependency-free local server running the same API handler.
- `scripts/build.mjs`: copies only public assets to `dist/`. Vercel bundles `api/` separately.
- `test/recommendations.test.js`: automated catalog, profile, AI contract and failure-path tests.

### Recommendation behavior

An in-memory lexical index combines BM25-style text relevance, editorial tags, optional major, and goals. Retrieval reserves interest coverage and diversifies categories, selecting up to 28 relevant candidates. Candidates reach Groq in alphabetical ID order, without heuristic scores. This scales to 1,000+ records (tested with a 1,320-record synthetic fixture); it is not embedding-based semantic search. GET /api/clubs provides search, category filters and pagination (24 records by default, maximum 60). The browser does not download the entire catalog.

Groq evaluates the student's overall preferences against the candidate descriptions, selects the clubs and rates six dimensions from 0 to 4: interests (35%), goals (25%), academic preference (10%), community/social goals (10%), practical fit (10%), and financial fit (10%). The server calculates percentages from these model ratings. Unknown evidence receives neutral half weight; an evidence-confidence multiplier limits scores to 65 for one preference dimension, 75 for one fact, 85 for multiple facts/dimensions, or 90 with documented practical and financial evidence; known conflicts lower this ceiling to 55. Multiplication preserves differences rather than clipping all strong matches to the same score. It can change retrieval order. The model selects evidence-to-answer connections using strict structured output. The server verifies every club ID, evidence ID, answer reference, score and duplicate before returning results. Names, descriptions, URLs and facts come exclusively from the catalog. Personalized explanations are assembled from the model's chosen connections and actual answers; unconstrained model-written factual claims are deliberately not displayed.

No API key: a clearly labeled non-AI fallback uses interest/goal overlap and an academic preference adjustment. It does not claim schedule, time, size or beginner suitability. With a configured key, provider errors, refusals or invalid output show a retry/browse error rather than silently switching to non-AI. Scores are estimates, not calibrated probabilities.

Question 10 is now an optional semester budget. Question 4 adds a separate THON option. Other questions are unchanged. All ten responses reach Groq. Source-backed details inform matching; unknown costs are never called free, and published dues exceeding a stated budget trigger a server-generated warning and a maximum estimated score of 55. Day/hour filters remain disabled because current schedules and total weekly commitment have not been confirmed.

## Catalog provenance and maintenance

Each record has a stable ID, campus, real name, short paraphrased description, official URL, source URL, verification date, source-linked facts, and editorial category/interest/goal/college mappings. The root has schema and catalog versions. `verifiedAt` means the cited source was reviewed on that date, not that current recruitment or annual recognition was confirmed. Some sources are older Penn State publications; consult the linked organization before joining.

Unknown meeting days, times, hours, group size, atmosphere, beginner eligibility, events and contacts are null/empty, not guessed. No placeholder clubs or events remain. Editorial tags and academic associations aid retrieval and are not university classifications or eligibility restrictions. The catalog is an initial subset, not the complete Discover directory.

Sources reviewed November 17–18, 2026 (every record carries its own source/date; additional source families are listed in CATALOG.md):

- Liberal Arts organizations: https://la.psu.edu/beyond-the-classroom/student-organizations/
- Engineering organizations: https://inclusion.engr.psu.edu/student-resources/student-organizations.aspx
- Agricultural/Biological Engineering: https://abe.psu.edu/undergraduate/resources/clubs-and-organizations
- Glee Club: https://arts.psu.edu/academics/school-of-music/music-ensembles
- Music Service Club: https://www.psu.edu/news/arts-and-entertainment/story/helping-harmonies
- Student Farm Club: https://agsci.psu.edu/students/clubs/list/student-clubs/student-farm-club
- Food recovery and poverty action: https://studentaffairs.psu.edu/support-safety/care-concern/basic-needs
- UPUA: https://www.psu.edu/news/agricultural-sciences/story/student-government-leaders-give-voice-college-agricultural-sciences

To add a club, verify its name, campus and purpose in an official PSU source, assign a unique stable ID and fact IDs, map editorial tags to existing quiz options, and record source/date. Review the source before changing facts. Retire records that can no longer be verified. Increment `catalogVersion` and run tests/build. Use the validated CSV/JSON/approved-feed importer documented in [CATALOG.md](CATALOG.md). There is no admin UI or automatic Discover sync.

### Discover access research

Official directory: https://discover.psu.edu/organizations

Anthology documents institutional API access, campus-managed credentials and endpoint/method permissions: https://help.anthology.com/engage/en/using-the-engage-api.html and https://engage-api.campuslabs.com/ . Public access to a website does not supply authenticated API credentials. No authorized Penn State API credential or export was available during this implementation. No private endpoints were scraped and no live sync is claimed.

Ask Penn State Student Affairs (`discover@psu.edu`, listed at https://studentaffairs.psu.edu/student-life/student-orgs) about a read-only organizations/events integration or approved public-field export. Nobody was contacted by this implementation. The approved-feed importer is ready for a normalized public-field feed. An institution-specific adapter still requires the approved schema and access. See [CATALOG.md](CATALOG.md) for exact fields, pagination, dry runs and retirement.

## Privacy

When enabled, answers go to the server and Groq. The application does not save quiz answers; this is not a promise of zero provider retention. See https://console.groq.com/docs/your-data . The application has no quiz database or response logging. Groq, hosting and optional Redis providers have their own operational retention policies. Redis stores a time-windowed hash of the requesting IP with a short expiry, not quiz responses. Local answers are cleared on refresh. `?test=1` explicitly enables local console/session-summary output including answers; do not share real student summaries without permission.

## Verification

```powershell
node --test
node --check app.js
node --check api/recommendations.js
node scripts/build.mjs
# After configuring your key (three paid synthetic requests):
node --env-file=.env.local scripts/smoke-ai.mjs
```

Tests use synthetic profiles and controlled provider responses, not paid Groq calls. To verify live AI, configure the key, restart, submit each profile below and confirm the results notice says **AI-ranked recommendations · Groq**. A fallback test is not evidence of successful live model access.

Manual acceptance checks at desktop and phone widths:

1. Load the landing page, browse clubs, search by name and filter categories.
2. Start the quiz; Next without a required answer must show an error. Test two/three-choice limits and Back.
3. Engineering: career + new skills, Engineering, major-related Yes, engineering + research interests.
4. Music: hobbies + friends, arts/music interests, relaxed atmosphere.
5. Service: community service + new skills, service + advocacy interests.
6. Complete all ten questions and observe sorting, mode disclosure, estimates, evidence and official links. Results should change between profiles.
7. Retake and open Browse before finishing: old scores and Back to my matches must be absent.
8. Try an unavailable API, then retry; browse must remain usable. Leave during loading: late results must not overwrite the current screen.
9. Check keyboard focus, reduced motion and no horizontal overflow at 360px.

## Prepare for Vercel (not deployed)

Import `Bhavya-1007/club-sorting-hat-ai-2` when ready. Use framework Other, Node 22+, build command `node scripts/build.mjs`, output `dist`. `vercel.json` includes function duration, JSON bundle files and response security headers. Set secrets in Vercel environment settings, never in the repository. Configure both Redis REST variables before enabling paid AI. Without an Groq key the deployment can run the labeled fallback.

Run a Vercel preview and live-model smoke test before production. This work does not push, deploy, register a domain, provision Redis, or obtain Discover API access. Vercel-specific deployment has not yet been executed.
