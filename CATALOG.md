# Catalog import and official access

## Final audit — 108 listings, 104 recommendation-eligible

See `FINAL-AUDIT.md` and `data/final-quality-audit.json` for the November 18 final review. Four records are held from matching, not deleted. Current recognition is unconfirmed; activity evidence is classified separately. Import updates preserve these audit decisions. Counts and older expansion notes below describe catalog inclusion, not current recruitment.

## Broad catalog update — 108 organizations

The later expansion added 38 records to the 70-record design-review catalog. The repeatable approved batch is `data/imports/2026-11-18-broad-expansion.json`: 24 Bellisario media/communications organizations, ten EECS technical organizations, three entrepreneurship organizations and the Nittany AI Student Society. Descriptions are short paraphrases, not claims of present recruitment.

Sources: [Bellisario](https://bellisario.psu.edu/current/student-organizations), [EECS](https://www.eecs.psu.edu/students/undergraduate/Organizations.aspx), [Enactus University Park](https://cpsse.psu.edu/club/enactus-university-park-0), [Happy Valley VC](https://cpsse.psu.edu/club/happy-valley-vc), [Nittany Entrepreneur Society](https://cpsse.psu.edu/club/nittany-entrepreneur-society), and [Nittany AI Alliance student resources](https://nittanyai.psu.edu/get-involved/students). Direct organization links were retained where listed by official sources. Otherwise the UI explicitly labels the link “Penn State source,” not an organization profile.

`node scripts/audit-catalog.mjs --write` produces `data/catalog-audit.json`. It checks normalized-name duplicates, shared Discover profiles, generic directory links, review age and known publication age. No duplicate candidates or generic Discover links were found. The Pennharmonics source is explicitly dated March 27, 2017 and flagged as historical; the other 107 publication dates are not recorded. This is not an exhaustive stale-content detection system. Every record has current recognition marked `not_confirmed`; none is advertised as currently active. The old internal `active` state is migrated to `listed`. Imports without publication dates preserve previously recorded dates.

Current detailed coverage includes five joining-process records (including HackPSU organizing-team interviews and CommAgency selection). The other detail coverage figures in the design-review section remain unchanged. The complete Discover directory remains unconnected: its public landing page requires JavaScript, and no approved full feed, export or institutional credentials were supplied. Public college listings plus reviewed JSON imports are the implemented acquisition method; no authentication restriction was bypassed.

## Design review expansion (schema v4)

All 66 previous records are preserved. Four organizations were added: 46LIVE, Blue & White Society, Penn State Powerlifting, and Oriana Singers. Only 46LIVE and Blue & White Society currently have explicitly verified THON involvement. The legacy `Service & THON` interest tag alone does not establish THON participation. A THON-only quiz retrieves only positively verified THON records.

Every organization now has `verifiedDetails` with these keys: `discover`, `website`, `weeklyHours`, `meetings`, `size`, `atmosphere`, `experience`, `joining`, `thon`, `costs`. Unknown fields are `null`. Known entries have `{value, text, source, verifiedAt}`. Descriptions, categories and editorial interest tags remain separate. A Discover URL is never generated from a name: only previously sourced direct links are populated. Verified third-party website/social URLs require an official PSU source establishing their association; none are guessed.

Numeric weekly hours and size must be nonnegative. Atmosphere is `relaxed`, `competitive` or `mixed`; experience is `required` or `not_required`; THON is boolean. Costs use `{semesterUsd, scope, additionalCosts}`; `semesterUsd: null` means no comparable semester amount, while zero means explicitly documented zero dues. Unknown additional obligations remain null. An annual charge is not divided into semesters. Published rates with an unspecified year are labeled as such and must be reconfirmed.

New reviewed evidence:

- [Bellisario directory](https://bellisario.psu.edu/current/student-organizations): 46LIVE's THON broadcasts and the University Park Blue & White Society listing.
- [Penn State Blue & White Society report](https://www.psu.edu/news/students/story/blue-and-white-society-host-ps-i): THON involvement.
- [Powerlifting joining page](https://sites.psu.edu/pennstatepowerlifting/join-the-team/): no prior experience required, joining paperwork, published $90/year or $60/Spring dues. The source does not specify the publication year. No current schedule or all-inclusive total cost is claimed.
- [School of Music ensembles](https://arts.psu.edu/academics/school-of-music/music-ensembles): Glee Club audition enrollment; Oriana's audition, welcome to all experience levels, and published size of sixty. Current enrollment may vary.

Current coverage: two documented THON participants, one published dues schedule, three joining-process records, two experience records and one published group size. Total weekly commitment, current meeting schedules and relaxed/competitive atmosphere remain unconfirmed. No organization is represented as definitively free. Synthetic zero-dues/competitive fixtures are used only in tests, never added to the student catalog.

The local catalog contains 108 sourced University Park organizations. It is a curated subset, not a connection to the complete Discover directory. Source review dates are November 17–18, 2026. Source review verifies published information, not current recognition or recruitment; some sources are historical. `status: listed` means included in this local catalog; `recognitionStatus: not_confirmed` explicitly separates this from current university recognition.

## Official access findings

- [Penn State Discover](https://discover.psu.edu/) is the official organization platform. No authorized complete public JSON feed or API credentials were obtained.
- [Anthology Engage API documentation](https://help.anthology.com/engage/en/using-the-engage-api.html) describes institutional API access and administrator-managed credentials/permissions. Public website access does not authorize private endpoints.
- An official [Involvement Fair directory PDF](https://studentaffairs.psu.edu/sites/default/files/Involvement_Fair_Directory.pdf) is publicly downloadable. It provides names/categories/table information, not a dependable current full export with descriptions, source update dates or recognition status. It has not been bulk-converted into guessed club descriptions.
- Request an approved read-only organizations feed or CSV/JSON export from Penn State Student Affairs / Discover administration (`discover@psu.edu`, [official contact page](https://studentaffairs.psu.edu/student-life/student-orgs)). No message has been sent.

Needed fields: stable organization ID, official name, campus, public description, category, official profile URL, recognition/status, and source update timestamp. Obtain permission to reuse these fields and the permitted refresh cadence. Optional logistics need explicit verification. Do not request private membership rosters, personal contacts or student data. A native Engage adapter cannot be finalized until Penn State supplies its approved endpoint, authentication and schema.

## Additional sources used for the 45-record expansion

- [Aerospace Engineering organizations](https://www.aero.psu.edu/academics/resources/student-organizations.aspx)
- [South Asian student organizations](https://asian.la.psu.edu/initiatives-and-institutes/south-asian-studies-at-penn-state/student-resources/)
- [Liberal Arts organizations](https://la.psu.edu/beyond-the-classroom/student-organizations/)
- [Health and Human Development organizations](https://hhd.psu.edu/undergraduate/student-organizations)
- [Club sports championship report](https://www.psu.edu/news/student-affairs/story/six-penn-state-club-sports-teams-win-national-championships)
- [Student Programming Association](https://www.spa.psu.edu/join/), [Urban Gaming Club](https://sites.psu.edu/urbangamingclub/), [International Student Council](https://iscpennstate.psu.edu/)
- [Pennharmonics historical Penn State report](https://www.psu.edu/news/arts-and-entertainment/story/pennharmonics-hold-spring-cappella-concert-senior-send-april-8)

The exact records and source links are preserved in `data/imports/2026-11-18.json`. Some official links lead to a PSU directory or article rather than a current organization profile; this is intentional where a direct profile was not verified. Descriptions are short paraphrases. Interest, motivation and college tags are editorial retrieval aids, not eligibility requirements.

## Import contract

JSON accepts an array or `{ "clubs": [...] }`. CSV uses a header row, quoted commas/newlines and pipe-separated tag lists. Required columns: `id,name,campus,category,description,officialUrl,source,verifiedAt,interestTags`. Optional: `motivationTags,relatedColleges,keywords,status`. JSON may include `facts: [{id,text,source}]`, with IDs prefixed by the organization's ID and a colon. See the researched batch for real examples. Tags must use the exact options in `questions.json`; campus must be University Park; URLs must be HTTPS Penn State domains. Dates must be real ISO dates, not future dates.

```powershell
# Validate and report changes without writing:
node scripts/import-catalog.mjs --file data/imports/2026-11-18.json
# Apply a reviewed export:
node scripts/import-catalog.mjs --file approved-export.csv --write
```

Imports reject duplicate IDs/names, invalid provenance and older verification dates. They upsert by stable ID, back up the old catalog under ignored `.catalog-backups/`, then replace it atomically. To retire an organization, import its complete record with `status: inactive`. Missing records are preserved, never automatically deleted. Restart the local server and rebuild after updates.

The importer does structural validation, not factual verification: an operator must review provenance and approved reuse first. Unknown schedules, size, commitment, events and contacts remain empty. Schema v4 accepts source-backed `verifiedDetails` in JSON. Legacy CSV/JSON imports without this field preserve previously reviewed details. Bare legacy logistics fields are not trusted.

An approved API adapter should expose pages shaped as `{ "clubs": [...normalized records...], "next": "same-origin URL or null" }`:

```powershell
node --env-file=.env.local scripts/import-catalog.mjs --url https://approved-feed.example/organizations
```

The example domain is a contract illustration, not an actual PSU endpoint. Set `CATALOG_API_TOKEN` only in local/server environment; optional `CATALOG_AUTH_HEADER` changes the authentication header. Default is `Authorization: Bearer ...`. No credentials in URLs. Redirects, cross-origin pagination and loops are rejected; requests time out, with 100-page and 20,000-record limits. Dry run is the default; add `--write` only after reviewing the report. This generic import capability is not a claim of authorized live Discover synchronization.

## Scale

Search indexes the active catalog once per server instance. `/api/clubs` pages at 24 items (maximum 60). Candidate retrieval returns at most 28 organizations and Groq returns at most eight. A 1,320-record synthetic fixture is tested without adding fake records to the production catalog. For substantially larger feeds, replace this in-memory index with a database search implementation behind the same endpoints.
