# Club Sorting Hat

A student prototype for EDSGN 367. New Penn State students (first-years, transfer, 2+2, and international students) answer 10 quick questions and get their top club matches, each with a short "Why you matched" explanation.

Plain HTML, CSS, and JavaScript. No frameworks, no backend, no build step, no login, and no data leaves the browser.

> **All 30 clubs in `data/clubs.json` are PLACEHOLDERS.** Replace them with real clubs from Penn State Discover before showing this to students.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page and all screens (landing, quiz, sorting animation, results, browse) |
| `styles.css` | All styling. Colors are at the top in `:root` |
| `app.js` | Quiz logic, the matching algorithm (`scoreClub`), results, browse, and test mode |
| `data/questions.json` | The quiz questions |
| `data/clubs.json` | The club list |

## Run it locally

Browsers block a page opened straight from your computer (`file://...`) from reading the JSON data files, so double-clicking `index.html` shows a "Couldn't load the club data" message. Serve the folder with any tiny local server instead. Pick one:

- **Python** (installed on most Macs): open a terminal in this folder and run `python3 -m http.server` (Windows: `python -m http.server`), then go to <http://localhost:8000>.
- **Node**: `npx serve .` then open the URL it prints.
- **VS Code**: install the "Live Server" extension, right-click `index.html`, and pick **Open with Live Server**.

On GitHub Pages it works without any of this.

## Deploy to GitHub Pages

1. Create a free account at <https://github.com> if you don't have one.
2. Click **+** (top right) → **New repository**. Name it, for example, `club-sorting-hat`. Set it to **Public** and click **Create repository**.
3. On the new repository page, click **uploading an existing file**. Drag in `index.html`, `styles.css`, `app.js`, `README.md`, and the whole `data` folder (keep the folder name). Click **Commit changes**.
4. Go to **Settings** → **Pages** (left sidebar).
5. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick the **main** branch and the **/ (root)** folder, and click **Save**.
6. Wait a minute or two and refresh. The page shows your live URL, something like `https://your-username.github.io/club-sorting-hat/`.
7. Turn that URL into a QR code (any free QR generator works) for the Involvement Fair table or HUB posters.

To update the site later, upload the changed files again (or edit them on GitHub with the pencil icon). Pages redeploys automatically within a minute or two.

## Edit the questions

Open `data/questions.json`. Each question looks like this:

```json
{
  "id": "hours",
  "type": "single",
  "required": false,
  "text": "How much time can you give per week?",
  "hint": "",
  "options": ["Under 2 hours", "2-5 hours", "5-10 hours", "10+ hours"]
}
```

- `text` and `hint`: safe to change any time.
- `type`: `single` (pick one), `multi` (checkboxes; add `"max": 2` to limit picks), `select` (dropdown; also uses `label` and `placeholder`), or `slider` (uses `min`, `max`, `default`, `minLabel`, `maxLabel`, and `valueLabels`).
- `required`: `true` hides the Skip button and requires an answer.
- You can reorder questions. The progress bar updates automatically.
- **Don't change an `id`.** The scoring code in `app.js` looks answers up by id (`motivation`, `college`, `majorRelated`, `interests`, `hours`, `freeDays`, `size`, `vibe`, `experience`, `contact`).
- **Option text is matched against club data.** If you rename an interest area, reason for joining, hour bucket, day, or college, rename it in every club in `clubs.json` too. Hour buckets are also listed in `HOURS_BUCKETS` near the top of `app.js`.

## Add or edit a club

<!--
  HOW TO ADD OR EDIT A CLUB
  1. Open data/clubs.json. Each club is one { ... } block inside the "clubs" list.
  2. To add a club, copy an existing block, paste it after another block, and put a comma between blocks.
  3. Give it a unique "id" (lowercase, no spaces) and fill in every field from the table in the README.
  4. Tag values must be spelled EXACTLY like the quiz options in data/questions.json, or the club won't match.
  5. Check your file at https://jsonlint.com before uploading. One missing comma or quote breaks the whole site.
-->

Open `data/clubs.json`. Each club is one `{ ... }` block in the `"clubs"` list. To add a club, copy an existing block, paste it after another one (with a comma between blocks), and edit the values. Check the file with a JSON validator such as <https://jsonlint.com> before uploading: one missing comma breaks the whole site.

| Field | What to put | Allowed values |
| --- | --- | --- |
| `id` | Unique short id | lowercase, no spaces, e.g. `"robotics"` |
| `name` | Club name | any text |
| `category` | Main category (used for the tag and the filters) | usually one of the interest areas |
| `interestTags` | Interest areas it fits | list from quiz Q4, e.g. `["Engineering & tech", "Science & research"]` |
| `motivationTags` | Reasons a student would join | list from quiz Q1, e.g. `["Build my resume / career"]` |
| `relatedColleges` | Colleges it relates to | list from quiz Q2, or `["Any"]` if it isn't tied to a major |
| `weeklyHours` | Typical weekly time | `"Under 2 hours"`, `"2-5 hours"`, `"5-10 hours"`, `"10+ hours"` |
| `meetingDays` | Days it meets | list of `"Monday"` ... `"Sunday"` |
| `meetingTime` | Usual meeting time (shown on cards) | text, e.g. `"7:00 PM"` |
| `size` | Membership size | `"Small"` (under 30), `"Medium"` (30-100), `"Large"` (100+) |
| `vibe` | How intense it is | `1` (relaxed) to `5` (competitive, high commitment) |
| `beginnerFriendly` | Can total beginners join? | `true` or `false` |
| `description` | Two-sentence description | text |
| `nextEvent` | Next recruiting event, or `null` | `{ "title": "...", "date": "2026-11-05", "time": "7:00 PM", "location": "..." }` (date as YYYY-MM-DD; past events hide automatically) |
| `discoverUrl` | Club's Penn State Discover page | full URL, or `""` to hide the button |
| `instagramUrl` | Club's Instagram | full URL, or `""` to hide the button |
| `groupMeAvailable` | Does the club have a GroupMe? | `true` or `false` |

`meetingTime` isn't in the original spec. It was added so cards can show meeting day *and* time. Leave it as `""` if you don't know it.

## Change the scoring weights

Open `app.js`. The settings are at the very top:

```js
const SCORING_WEIGHTS = {
  interest: 30,
  motivation: 20,
  time: 15,
  schedule: 10,
  major: 10,
  vibe: 10,
  size: 5,
};
const BEGINNER_PENALTY = 15;
const MAJOR_OPEN_TO_ALL_SHARE = 0.3;
```

Change the numbers and reload. Keep them adding up to 100 so they're easy to read; the math normalizes anyway. How each criterion works is explained in the comment above `scoreClub()` in `app.js`:

- **Interest / motivation**: the share of the student's picks that appear in the club's tags.
- **Time**: full points for the same hour bucket, half for one bucket away, zero otherwise.
- **Schedule**: full points if any of the student's free evenings is a meeting day.
- **Major**: only counts if the student answered Yes or No to Q3 and picked a college other than Undecided. "Yes" gives full points to clubs linked to their college and `MAJOR_OPEN_TO_ALL_SHARE` to clubs open to any major. "No" gives full points to clubs *not* linked to their college.
- **Vibe**: 10 minus 2.5 points per step of difference on the 1-5 scale.
- **Size**: full points for an exact match. "No preference" means it doesn't count.
- **Skipped questions** never cost a club points; their weight is spread across the rest.
- **Penalty**: `BEGINNER_PENALTY` points off when the student has no experience and the club isn't beginner friendly.
- **Ties** are broken alphabetically.

Other settings in the same place: `FEEDBACK_FORM_URL` (paste your Google Form link here), `SORTING_DELAY_MS` (the "Sorting you..." animation length), `TOP_COUNT`, and `ALSO_COUNT`.

## Test mode for user interviews

Add `?test=1` to the URL, for example `https://your-username.github.io/club-sorting-hat/?test=1`. A yellow banner confirms it's on. When the student finishes the quiz:

- The browser console (F12 → Console) logs total quiz time, time per question, which questions were skipped, and the full ranked list with scores.
- A **Copy session summary** button appears on the results screen. It copies the same information as plain text to paste into your interview notes.

Nothing is saved or sent anywhere. Reloading the page clears everything.

## Accessibility notes

- Every input has a label, focus is moved to each new question's heading, and all controls work with the keyboard (Tab, Space, Enter, and arrow keys on the slider).
- Tap targets are at least 44-48px tall. The layout works down to 360px wide.
- Animations are turned off for users who set "reduce motion" on their device.
- Text colors meet WCAG AA contrast. The gold accent is only used with navy text.
