# Verification record — November 18, 2026

## Final stabilization release

34 automated tests pass. The HTTP release smoke passed all three profiles and concurrent duplicate checks: engineering and music returned live Groq, service returned explicitly labeled fallback. Provider failures now preserve usable recommendations. Production variable validation correctly reports absent Upstash credentials; live Redis verification remains pending those credentials. See RELEASE.md for the activation steps. Earlier audit behavior below is historical.

## Final pre-publication audit

- 29 automated tests pass, including catalog holds surviving imports, model ID/evidence validation, conservative confidence scaling, and documented financial/experience/commitment conflicts. Static build, JavaScript syntax checks and whitespace checks pass.
- All 12 Discover profile URLs were rendered in the browser and matched University Park organization identities; current activity remains unconfirmed unless separately documented.
- 108 listings reviewed; 104 recommendation-eligible, four held. No normalized-name/profile duplicates. See `FINAL-AUDIT.md` and the per-record `data/final-quality-audit.json` for activity and source limitations.
- Completed all ten questions through the browser at 1280×800 (engineering) and 360×800 (music/social), both with real Groq responses. Engineering returned AeroWomen, AIAA, SSPL, Wind Energy, ACM and Robotics; music returned Music Service Club, Creative Writing, Glee, Oriana and SIMA. Scores varied (engineering 51–64; music 44–62 in these runs). Results are nondeterministic estimates.
- Observed sorting animation, retake clearing results, category filtering, catalog search and held-record disclosure. Mobile document width 345 within 360 viewport; no horizontal overflow. Screenshots: `test-results/final-desktop.jpg`, `test-results/final-mobile.jpg`.
- Live Groq: THON, engineering and music passed in the final batch (`test-results/live-final-audit.txt`). The service call hit schema rejection followed by a rate-limited retry. An isolated service rerun after the quota reset passed (`test-results/live-service-final.txt`), returning International Student Council, Food Recovery Network, Music Service Club, AID, Sign Language Organization and French Club. Thus all requested profiles succeeded individually; the full sequential batch did not finish cleanly. The 8,000-token/minute account limit can block the bounded recovery call (service input requested roughly 6,200 tokens). Smoke calls are spaced 65 seconds. Failures remain explicit, not silent fallback.
- `.env.local` remains Git-ignored; key presence checked without printing it. Shared Upstash settings are absent locally. Public beta requires shared rate limits and a deployment preview validation; neither push nor deployment performed.

## Design review and broader catalog update

Earlier checks below predate the final audit above.

- Catalog: 108 sourced University Park organizations, preserving the original 66. Audit found no normalized-name duplicate candidates or duplicate Discover profiles, and no generic Discover directory URL presented as a club profile. One known historical publication is flagged; recognition is unconfirmed for all records.
- 24 automated tests passed, including optional budget validation, ten-question IDs, THON-only retrieval requiring evidence, unknown/zero/over-budget dues, verified experience/atmosphere warnings, detail provenance and preservation, fabricated preference-evidence rejection, import validation, audit fixtures and 2,160-record synthetic retrieval.
- Static build and syntax checks pass. Re-import of the 38-record expansion dry-runs to zero additions / 38 updates / 108 total, without writing.
- Real Groq THON smoke test passed: 46LIVE 74 and Blue & White Society 65. Browser THON results varied (85/76), illustrating that scores are model estimates, not calibrated measurements. Unknown fees were not labeled free.
- Real Groq aerospace smoke test passed against the expanded catalog: AeroWomen, AIAA, Student Space Programs Laboratory, Unmanned Aerial Systems and ACM. Music smoke passed with Creative Writing Club, Music Service Club, Oriana, Glee Club and Fanaa. These profiles produced different rankings and grounded explanations. Groq model/key configuration was preserved.
- At 360px, completed all ten questions including THON and the new Free only budget. Observed sorting and live AI mode; document width 345px within 360px viewport. Budget question shows six options plus Skip. Retake then Browse shows zero stale scores. Powerlifting search displays published dues, no-experience requirement and joining steps with current-rate uncertainty.
- Final browser check after the 108-record server restart: landing page shows the actual catalog count, Powerlifting search shows 1 of 108, and the single Club details disclosure expands source dates and unknown attributes. Tested at 1280px desktop and 360px mobile, with no horizontal overflow. Saved `test-results/catalog-108-desktop.jpg` and `thon-mobile.jpg`. Preview remains running; no push or deployment.
- Earlier baseline records below document prior stages. Their old catalog counts and former OpenAI/no-key limitations do not describe the final implementation.

## Groq migration — live verification

- Confirmed `GROQ_API_KEY` is loaded using a boolean-only check, and `GROQ_MODEL` equals `openai/gpt-oss-20b`. No credential value was printed. `.env.local` is ignored and untracked by Git, and returns HTTP 404 from the local server.
- Migrated the backend to Groq's OpenAI-compatible Chat Completions endpoint, strict JSON schema, Groq-only environment variables, provider-aware notices, and Groq usage limiting. OpenAI credentials are no longer used. Model ratings and evidence references remain server-validated.
- 16 automated tests pass, including bounded schema-error retry and shared deadline, provider failures and rate limits. Syntax/build/diff whitespace checks pass.
- Real Groq calls succeeded separately for engineering, music and service profiles. An initial combined three-profile smoke run failed on an intermittent provider schema error; it is not recorded as a successful complete batch.
- Final isolated command `node --env-file=.env.local scripts/smoke-ai.mjs --profile=music` exited 0. It returned five grounded AI matches: Glee Club 78, Music Service Club 70, Creative Writing Club 68, Kalliope 68, Raaga 60. Scores are model estimates, not calibrated probabilities.
- Completed all ten quiz questions in the actual browser, observed sorting, and verified the results notice says `AI-ranked recommendations · Groq`, with personalized explanations and estimated AI scores. Screenshot: `test-results/groq-live-results.jpg`.
- Groq returned 429 errors under rapid testing at the account's 8,000-token/minute limit. The UI displayed a retry message rather than falling back. Waiting allowed a successful browser retry. Intermittent schema-generation rejection receives at most one provider retry within the original 25-second deadline; no authentication/quota retries or failed-generation output are accepted.
- Local preview restarted with Groq configuration and left running at http://127.0.0.1:3000. Homepage HTTP 200 and Groq privacy notice verified. No push or deployment performed.

The OpenAI/no-key notes below describe the earlier implementation, before this migration.

## Latest upgrade checks

- 15 automated tests pass. Added pagination, category/text search, 1,320-record synthetic scale fixture, import validation/stale-update rejection, complete profile plus optional major, rubric uncertainty cap and cross-IP daily request budget tests.
- Syntax checks and static build pass. Re-importing the researched 45-record batch in dry-run mode reports 45 updates, zero new records and 66 total; no write occurred in this check.
- Local HTTP: homepage 200; paginated catalog 200 with 66 total / 24 on first page; recommendation POST 200 with explicit fallback mode; `.env.local` 404 and Git-ignored.
- Desktop: completed all ten questions with Aerospace Engineering entered, including optional questions. Observed sorting screen, then AIAA, AeroWomen, ASABE and Nittany Rocket Labs among results.
- Music/social: Fanaa, Creative Writing Club, Kalliope, Music Service Club and Glee Club led the fallback results.
- Service/cultural: AID at University Park, International Student Council, SHPE, Global Brigades Legal Empowerment and Students United Against Poverty led the fallback results. These are distinct heuristic results, not evidence of live AI quality or inferred student identity.
- Retake then Browse: zero old score badges. Pagination moved from records 1–24 to 25–48. Search for aerospace returned two records. Mobile catalog at 360px showed no horizontal overflow (345px document width).
- Live smoke command was attempted and stopped before a provider request because `OPENAI_API_KEY` is empty. No live-model success is claimed. The smoke script now sends all ten answers for three synthetic profiles, prints explanations and checks distinct rankings.
- Repeated the music/social quiz at 360px through sorting and the updated results cards; no horizontal overflow. Saved `test-results/results-mobile.jpg` and `results-desktop.jpg`, then reset the viewport override. Browser error/warning log was empty during the three-profile desktop check.

Earlier baseline checks below remain useful history; the count of nine tests refers to the November 17 baseline.

## Passed

- Node syntax checks for the browser application, Vercel endpoint and local server.
- `node --test`: 9 tests covering catalog integrity, ten-question validation, three profile rankings, candidate limits, strict OpenAI request/response contract, model-controlled ranking, fabricated IDs/evidence, duplicates, provider failures/refusal/incomplete JSON, rate limiting and endpoint rejection cases.
- `node scripts/build.mjs`: public static output generated successfully.
- Actual browser testing against the local Node server, at desktop and 360px mobile width.
- All ten questions completed for an engineering profile; required-answer validation observed; sorting screen observed; recommendations rendered.
- Music and service profiles completed through the real browser and local endpoint. Optional skip flow worked.
- Music results: Creative Writing Club, Music Service Club, Penn State Glee Club.
- Service results: Students United Against Poverty, University Park Undergraduate Association, Student Farm Club, Food Recovery Network, Music Service Club.
- Retake followed by Browse: zero stale score badges; Back to my matches hidden.
- Browse name search and category filters; result category filter and clearing filters.
- Mobile document width did not exceed viewport width (345px content inside 360px viewport with scrollbar).
- No browser error/warning logs observed in the completed flow.
- Desktop/mobile screenshots saved locally under ignored `test-results/`.

## Not yet verified

- Live OpenAI call: no API key was provided or present. AI branch is contract-tested with simulated provider responses, not a paid-model quality evaluation.
- Distributed Redis integration: unit-tested with controlled REST responses; no Redis service provisioned.
- Vercel preview/production runtime: deliberately not deployed or pushed.
- Current recruitment/recognition status of every club: catalog verifies official published sources, including some older articles, not a live Discover export.
- Automated Discover sync: institutional credentials/export remain unavailable.

## Live AI test after configuration

Set a valid key locally, then run this explicit paid test using synthetic profiles:

```powershell
node --env-file=.env.local scripts/smoke-ai.mjs
```

The script requires genuine AI mode, validates outputs, and checks that the three profiles do not all receive the same top ranking. It prints only organization IDs and scores, never credentials. Then restart the local app and repeat the browser quiz to inspect the explanations.
