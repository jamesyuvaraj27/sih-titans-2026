# The five-minute demo

Run `cd server && npm run db:reset` before every rehearsal. The seed is deterministic, so the
numbers below are the numbers you will see.

Two browser windows, ready before you start:
- **Window A** signed in as `anitha@mospi.gov.in` (learner) on the dashboard
- **Window B** signed in as `rajesh@nssta.gov.in` (trainer) on `/trainer`

`server/samples/stratified-sampling-nssta.pdf` staged in the file picker. **Never demo on a
file you have not run through the pipeline before.**

---

## 0:00 – 0:30 · The claim

> "Every competency score in this system is computed from dated evidence, never stored, and
> every one of them can be replayed and audited. Nothing else here matters if that isn't
> true, so let me show you that first."

Window A, dashboard. Point at three numbers and move on: **3 of 11 role requirements met**,
**5 critical gaps**, **evidence records on file**. Do not narrate the radar chart.

## 0:30 – 1:20 · The Evidence Ledger

Click **Field Operations & Supervision** (L3, score 70.8).

> "Three dated records. Each row is weight × quality × relevance × decay. Decay is
> 2 to the minus months over half-life — so unused skill fades on its own, it isn't a feature
> we added. The raw total 1.968 goes through a saturating curve and gives 70.8. You can check
> that on the screen with a calculator."

Drag **Replay as of** back. The score falls as the recent evidence leaves the window.

> "That is not a stored history. It is the same function with a different date, which is
> exactly what an auditor would do."

**If you only have 90 seconds, this is the demo.** Stop here and take questions.

## 1:20 – 2:20 · Upload → generate → the rejects

Window B. Upload the sampling PDF. Show the tagging panel:

> "Five chunks, each keeping its page number, tagged to competencies by an embedding that
> runs locally — nothing was sent anywhere. These are the actual terms that drove the match."

Generate. Then **open the rejected bucket** — this is the beat nobody else will have.

> "Twenty-eight candidates, seventeen accepted, eleven rejected — thirty-nine percent, inside
> the fifteen-to-forty-five band we consider healthy. Here's why each one failed: eight had
> distractors too far from the key to be plausible, three leaked the answer in the stem.
> A generator without a rejection rate isn't an assessment engine."

Open one accepted item and show the source quote beside the question.

> "Every accepted question carries a verbatim quote from the page it came from. That's a
> string comparison, not a judgement call — a question that can't point at the sentence
> justifying it never enters the bank."

Approve four or five.

## 2:20 – 3:00 · Take it, and close the loop

Window A → **Assessment** → target **Stratified Sampling** → answer three questions.

Show the feedback panel: the rationale, why the chosen distractor is wrong, and the citation.

Submit. Read the result panel out loud:

> "Your score wasn't written anywhere. A dated evidence row was appended — here's its id —
> and every score that depends on it is now recomputed from the ledger."

Back to the dashboard. **Stratified Sampling has moved and the gap has closed.**

## 3:00 – 3:40 · Gap → path → iGOT

`/gaps`:

> "Severity is gap times criticality times urgency. All three factors are on screen. Urgency
> rose here because the Annual Survey of Industries returns processing starts in twenty days
> and needs this competency — that comes from a calendar row, not a model."

`/path`:

> "Ordered by prerequisite first, then severity, then quickest win, then how many other
> competencies the step unblocks. No step can appear before something it depends on, and that
> is guaranteed by a topological sort, not by a prompt. The courses are iGOT and NSSTA
> TPAC-recommended programmes."

## 3:40 – 4:20 · The administrator's question

Window B → sign in as `admin@mospi.gov.in` → **Workforce**.

> "Coverage is measured against role requirements, not against the whole ontology. Python for
> Data Analysis: zero of the twenty officials whose role requires it actually have it. That
> is the capacity gap the problem statement describes, quantified."

Scroll to the heatmap. Then point at the suppression notice:

> "Any figure computed from fewer than five officials is suppressed, so a department view
> can't be used to read one person's record."

## 4:20 – 4:50 · The two proof moments

In a terminal beside the browser:

```sql
DELETE FROM "Evidence" WHERE "officialId" = 'off_anitha';
```
> "The database refuses. Append-only is a Postgres trigger, not a promise in our code."

Then in the trainer screen, switch the generator to **Ollama (local, sovereign)** — or just
point at the option.

> "Generation runs against a local model on a single machine. Embeddings are already local in
> every configuration. That's a deployment mode, not a slide."

## 4:50 – 5:00 · Close

> "An auditable competency layer on top of iGOT Karmayogi, not a replacement for it. Every
> score explains itself, every generated question cites its source, and no language model is
> anywhere near the number that decides an official's training."

---

## The three things you must not do

1. **Do not claim a live iGOT integration.** Say: "there is no public third-party iGOT API,
   so we implemented against the Sunbird contract iGOT runs on — moving to a live instance is
   a base URL and a key." Volunteering that is worth more than the integration would be.
2. **Do not demo on an unseen file.** The gate is honest; a bad document produces few
   questions, and that is the correct behaviour, not a good demo.
3. **Do not skip the reject panel.** It is the single most differentiating thirty seconds in
   the whole run.

## Failure kit

- Recorded video of every beat above, on two laptops and a USB stick.
- The full stack running locally, tested with the network cable out. `AI_PROVIDER=mock`
  works with no key and no internet.
- A database dump so a fresh machine is running in ninety seconds.
- A printed one-pager: the scoring formula, the eight gates, the Sunbird answer.
