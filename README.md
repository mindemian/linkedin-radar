# LinkedIn Radar

Your LinkedIn connections list is a few thousand people and you cannot read it.
This scores every one of them against what you are actually looking for, sorts
them into tiers, and hands you a CSV of the few dozen worth contacting.

It runs two separate searches over the same export:

- **Grant clients** — organizations that need grants written and have nobody
  in-house to write them.
- **Innovation roles** — people who could hire you into a Director of Innovation
  role, or introduce you to someone who can.

The same person scores differently in each. A grantmaking foundation is a
non-customer in the first and a strong contact in the second. You switch between
them with a dropdown; no re-upload.

Your files are read in your browser and never uploaded. Only the handful of
fields the questions ask about are sent for scoring.

---

## 1. Get your files out of LinkedIn

1. LinkedIn → **Settings** → **Data privacy**
2. **Get a copy of your data**
3. Tick **Connections** and **Invitations**, request the archive

LinkedIn emails you a zip, usually within ten minutes. Inside are
`Connections.csv` and `Invitations.csv`. Either one works on its own; with both,
the app also matches which invitations were accepted and which are still
pending.

## 2. Use it

Drop the files in. The app tells you how many rows it read, which date format it
found, how many people have no job title, and how many invitations arrived with
no message. If you drop a file in the wrong box it moves it and says so.

Press **Run**. The grid fills in as it goes, coloured by tier:

| | |
|---|---|
| **Tier 1** | Prime. A decision-maker at a grant-seeking organization with nobody in-house. |
| **Tier 2** | Worth contacting, harder conversation. Includes anyone with no job title in the export. |
| **Tier 3** | Plausible but weak. |
| **Funder** | Gives money away rather than applying for it. A separate conversation. |
| **Rejected** | Not a grant-seeking organization. Faded out. |

Click anyone to see every question, the answer, and how sure the model was.
Tick **DM** and **Acc** as you work through them; those save in your browser.

Roughly **four cents per thousand people**, and about a minute.

## 3. Run your own copy

### Get a key

Sign up at [typesafe.ai](https://typesafe.ai) and create an API key. It starts
with `apikey_`. Copy **only the key** — if the dashboard shows `API key:
apikey_...`, leave the label behind. (The app strips it if you paste it anyway.)

### Deploy

1. Fork this repository.
2. At [vercel.com/new](https://vercel.com/new), import the fork. Leave every
   build setting alone; Vercel detects Next.js.
3. Before deploying, open **Environment Variables** and add `TYPESAFE_API_KEY`
   with your key. Leave all three environments ticked.
4. Deploy.

Changing that variable later needs a redeploy to take effect: **Settings** →
**Environment Variables** → edit → **Deployments** → three dots on the newest →
**Redeploy**.

---

## Changing what it looks for

### The ICP

`lib/icp.config.ts` holds both searches — what you sell, the roles worth a
conversation, geography, the kinds of organization, and who is excluded. Every
question's options are built from it, so this is the only file to edit. Run
`npm run build` afterwards: the contract check confirms the questions still hold.

### The questions

`lib/presets/grant-clients.ts` and `lib/presets/innovation-roles.ts`. Each
question carries its own instructions and a criterion for every possible answer.
The **Methods** page in the app renders all of it verbatim, which is the honest
answer to "why did it say that".

### The Classifier Studio

Everything above is also editable inside the app, at **/studio**. Rewrite any
question, add or remove answer options, change a question's type, pick which
fields it reads, and drag the thresholds.

Two things there are worth understanding, because they behave differently:

- **Moving a threshold is free.** It re-sorts everyone from answers already
  stored and makes no new request. The tier counts update as you drag.
- **Editing a question is not.** The answers on file were given to the old
  wording, so the app tells you how many rows are now out of date and asks you
  to re-run. It will not quietly show you counts derived from a question you
  have since changed.

Shipped presets are read-only. Your first edit forks them, so **Reset to
defaults** always has something to go back to. **Download JSON** and **Upload
JSON** move a preset between machines; an uploaded preset goes through the same
validation as everything else, so it cannot smuggle in a forbidden field.

---

## The rules this is built on

**The model judges meaning. Code does everything countable.** Dates, matching,
direction, tier arithmetic and every total are computed in code and never asked
of a model, because models are unreliable at exactly those things.

**No question may read a field that is not in the export.** Location, company
size, revenue, industry codes and activity are not in a LinkedIn export, so no
question asks for them. A question naming one fails the build. The same
validator runs in the editor and again on the server, so the rules cannot be
talked around.

**A question is never asked to misdescribe the world.** Universities apply for
grants constantly. The question says so honestly, and the decision to exclude
them is applied afterwards in code, because an answer that has to lie in one
place cannot be trusted in another.

**Escape answers are real answers.** "unknown", "unclear" and "not stated" are
always available, and the instructions say when to choose them. A model forced
to guess produces confident nonsense.

---

## Enrichment

Not configured. `/api/enrich` is a documented stub and no Apify actor has been
selected, because choosing one means reading its input schema and pricing and
testing it against real profiles.

To switch it on: pick an actor that takes a list of profile URLs and needs no
LinkedIn cookies, put its id in `lib/apify.config.ts`, map its output in
`mapItem`, and set `APIFY_TOKEN` in Vercel. Until then, **Import enrichment
JSON** takes any JSON array of profile objects and runs it through the same
mapper, so the live path and the import path behave identically.

---

## Development

```bash
npm install
cp .env.example .env.local   # paste your key
npm run dev

npm test                     # 47 checks, no network
npm run fixtures             # synthetic test files, gitignored
npx tsx scripts/live-check.ts  # both presets against the live model
node scripts/browser-check.mjs # 21 checks driving a real browser
```

Fixtures are generated and never committed. No personal data is in this
repository.
