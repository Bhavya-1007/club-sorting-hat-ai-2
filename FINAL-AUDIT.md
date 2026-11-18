# Final quality audit — November 18, 2026

108 records reviewed for names, University Park context, duplicate names/profile URLs, source provenance and review dates. **104 are eligible for recommendations; four are held, not deleted.** This is an evidence-quality decision, not confirmation that all 104 are recruiting or currently university-recognized.

| Held record | Reason |
| --- | --- |
| The Pennharmonics | Only a 2017 event report confirmed |
| Urban Gaming Club | Site still advertises Spring 2024 |
| Enactus - University Park | Official source corroborated in search, but repeated live connection resets |
| Happy Valley VC | Official source corroborated in search, but repeated live connection resets |

Activity classification: four records have recent activity/participation evidence (UPUA, Blue & White Society, Music Service Club, International Student Council); six sports records document the 2024–25 season; two are historical-only; 96 have undated listings. Recent evidence is not proof of activity today or recognition. Music Service Club has a 2017 primary article plus a 2026 election biography corroborating participation. All 108 recognition statuses remain unconfirmed.

The machine-readable per-record review is `data/final-quality-audit.json`. No normalized-name or repeated Discover-profile duplicates were found. Names are sourced, including the corrected display name HackPSU; some catalog labels retain campus context. Penn State Network Television and PSN News are separately listed programs, not presumed independent registered organizations. College-based listings establish University Park context; this is not a full Discover registry export.

## Links and repairs

Final network check: **47 distinct URLs, 45 HTTP 200, two unresolved** (the held CPSSE records). Twelve successful URLs return JavaScript-only shells to raw HTTP. All twelve were subsequently checked in the browser: each rendered the expected University Park organization profile. `data/discover-profile-audit.json` records their exact directory names. This confirms profile identity and links, not current recognition or activity. `data/public-link-audit-before.json` preserves the initial failures and `data/public-link-audit.json` the repaired check.

- Removed the broken Multicultural Women's Forum Discover URL (404); its official Liberal Arts listing remains.
- Removed UAS's website with a certificate-chain failure; retained its working official EECS listing. No TLS bypass.
- AIAA's department-linked website returns 404, so it was not adopted; the aerospace department source remains.
- Added working organization-specific links for SSPL, Rocket Labs, After the Whistle, CommRadio and La Vie from their Penn State sources.
- ISC's site contains unrelated template contact details; those were not imported. Participation is separately corroborated in a 2026 Penn State election biography.
- Powerlifting's published dues page has no publication date. Its amounts are labeled published information requiring current confirmation.

Some organizations only have an official department listing, not a verified standalone organization page. The UI explicitly labels those links “Penn State source.” Do not advertise every record as having a working organization-specific profile.

## Matching safeguards

Held records are excluded at retrieval, fallback and model-response validation. Routine imports preserve holds and activity evidence. Groq's strict schema limits IDs to candidates; server validation also rejects unknown/cross-club evidence, duplicate IDs, unsupported logistics and invalid explanation angles. Each supplied fact lists its permitted answer IDs. A malformed schema or unsupported connection allows one bounded retry, sharing the original 25-second deadline; validation is never relaxed. At most two provider calls can occur per accepted quiz request. Names, descriptions and URLs are always resolved from catalog records.

The six model-rated dimensions remain substantive ranking inputs. Evidence-confidence scaling prevents a single shared interest from producing a near-perfect score without flattening ratings into a common hard cap. Maximum confidence factors are 65%, 75%, 85% or 90%, depending on distinct preference dimensions and evidence; documented conflicts reduce the factor to 55%. These multiply the weighted rubric, not calibrated probabilities.

THON-only retrieval requires documented THON involvement. Documented budget, experience, competitive atmosphere and weekly-hours conflicts affect scores and warnings. No production record currently documents a numeric weekly-hours requirement; commitment-conflict behavior is tested with synthetic fixtures, not presented as verified real-world schedules. Unknown costs and experience requirements are never assumed free or beginner-friendly.

## Beta decision

Suitable for supervised local testing. **Public beta is conditional, not yet deployment-verified:** configure shared Upstash rate-limit storage (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) alongside server-only `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-20b`, then test a Vercel preview before opening access. Current local environment has Groq configured but no shared limiter. The deployed endpoint fails closed without it. No services were provisioned and nothing was pushed or deployed.

Groq quota can reject closely spaced requests; the app reports that honestly. The smoke script spaces calls by 65 seconds. Account-level concurrency can still exceed quota. Catalog limitations and uncertain activity must remain visible during beta.

Final results: 29 automated tests pass; build/syntax/whitespace checks pass. Complete desktop and mobile quizzes returned live Groq results. THON, engineering, music and service profiles all succeeded individually with different relevant selections. The sequential smoke batch encountered a schema failure followed by an 8,000-token/minute quota failure; isolated service retry passed after reset. This intermittent provider failure remains a beta reliability limitation, despite strict validation and bounded recovery. See `TESTING.md` for details. Local preview: http://127.0.0.1:3000.
