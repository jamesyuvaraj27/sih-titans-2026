# Jury Q&A

Answer these out loud, standing up, before the finale. An answer you have not said aloud is
not an answer you have.

The pattern that works: **state the honest position first, then show the artefact.** Every
answer below has something on screen or in a terminal behind it.

---

### "Did you actually integrate with iGOT Karmayogi?"

No — and I'd rather tell you that than claim otherwise. There is no public third-party iGOT
API: no sandbox, no key a student team can request. But iGOT runs on Sunbird, the open-source
MeitY stack, and Sunbird's APIs are documented and open. So we built to the contract iGOT
actually runs on — the same identifiers, the same request and response shapes. Moving to a
live instance is a base URL and an API key, not a rewrite. The HTTP adapter and the
dual-implementation contract tests are the next piece of work, and I'd rather show you a
seeded catalogue behind a real contract than a fake integration behind a screenshot.

### "How do I know the AI isn't hallucinating competency scores?"

It structurally cannot. No language model call is anywhere in the scoring path. A score is a
SQL function over an append-only ledger — weight, quality, relevance, decay, summed and
passed through a saturating curve. Language models in this system write questions and
explanations, nothing else. Our acceptance suite asserts it.

*[open a competency, point at the ledger footer]* — and the arithmetic is on screen. You can
check it with a calculator.

### "What stops an administrator quietly changing someone's score?"

Two things. First, there is no score to change — scores are computed, not stored. Second, the
evidence they'd have to change is append-only, and that is enforced by PostgreSQL, not by our
code. *[run the DELETE in psql, show the error]* A correction inserts a new row and points the
old one at it, which is itself a write that leaves a trace.

### "Why not Neo4j / a graph database?"

Sixty nodes, seventy-nine edges. The query that walks the full relevance map and aggregates
the entire evidence ledger runs in 2.7 milliseconds in Postgres. A second database would add
a deployment, a backup story, a failure mode and a security review for no measurable gain.
That calculus flips at around a million nodes with six-hop traversal, or if we needed real
graph algorithms at scale — if the national cross-ministry skill graph is ever built, that is
the migration point.

### "Where does government data go?"

Embeddings are computed locally in every configuration — no official's profile and no
uploaded departmental material is ever sent to a hosted embedding API. Generation is behind a
provider seam with three implementations: a hosted model, a local model over HTTP, and a
deterministic offline one. *[switch to Ollama]* This runs air-gapped on one machine. Storage
is Indian-region. The data-flow is one diagram and I can show you what, if anything, crosses
the boundary.

### "How is this different from asking ChatGPT to write quiz questions?"

The gate. *[open the rejected bucket]* Twenty-eight candidates, eleven rejected, and here is
the specific reason for each. Every accepted question carries a verbatim quote from its
source page — so groundedness is a string comparison, not an opinion. And the questions are
tagged to a competency, so passing one appends evidence that moves a record. A generator
without a rejection rate is not an assessment engine.

### "Who maintains the competency ontology? You won't be here."

NSSTA, through the admin interface — and underneath, it is structured data in version control
with a validating build that fails on a cycle or a dangling reference. A methodology division
proposes a change as a reviewable diff. We are not asking a ministry to trust a black box
they cannot edit. Sixty competencies is a starting frame, not a finished dictionary.

### "Your difficulty labels — where do they come from?"

A stated heuristic: Bloom level, how close the distractors sit to the key, lexical
complexity, length, whether numeric reasoning is involved. The honest position is that real
difficulty needs response data. Once an item has around two hundred responses we fit a 2PL
IRT estimate and keep *both* numbers, so the drift between what we predicted and what
learners actually did is visible. That comparison is more useful than either number alone.

### "What about the officials who aren't online? Field staff, poor connectivity."

Offline is designed and not built — it is on the P2 list and I am not going to tell you it
works. What is designed: the shell and downloaded quizzes cached, submissions queued in an
outbox with idempotency keys, drained in order on reconnect. What will never work offline:
generation, enrolment and any admin function, and the UI should say so rather than fail
silently.

### "What doesn't work? What are you least happy with?"

Three things, in order.

1. **The ontology is not yet traced to published sources.** Role titles and course names are
   modelled on MoSPI and NSSTA vocabulary but I have not yet reconciled every one against the
   published NSSTA training calendars and the ISS probationary manual. That is the first thing
   I fix, because you would spot an invented cadre name instantly.
2. **The embedding is lexical, not semantic.** It maps "stratified sample allocation" to
   stratified sampling correctly; it will not map "prices went up" to inflation. It is one
   function behind an interface, and swapping in a sentence encoder is a P1 task — I chose
   this deliberately so nothing leaves the machine and so tagging is explainable.
3. **The iGOT catalogue is seeded, not live**, for the reason in the first answer.

### "How would this scale to 1.5 crore officials?"

Not on this deployment, and I would not claim otherwise. The score computation is per-official
and index-backed — that part scales fine. The two things that would need work first are the
workforce view, which currently computes every official's profile in a loop and should be a
single aggregate query with a materialised cache, and the ontology growing past the point
where a recursive CTE is the right tool. Neither is a rewrite; both are known.

### "Why should MoSPI use this rather than extending iGOT?"

They should extend iGOT — that is the point. This is an intelligence layer on top of it, not
a replacement. iGOT hosts the learning; we answer the question iGOT does not: what can this
official actually do, how do we know, and what should they learn next. We do not host course
video. We do not write to APAR — we produce an APAR-ready competency statement that a human
signs.

### "What did you build yourselves?"

The ontology, the scoring model, the append-only enforcement, the eight-gate quality filter,
the path optimiser and every screen. The libraries are standard — Express, Prisma, React,
Recharts, a PDF text extractor. Nothing that makes a competency decision came off a shelf.

---

## Questions to ask *them*

If the conversation opens up, these turn a Q&A into a discussion and they signal that you
understand whose problem this is:

- "Which competencies would a methodology division actually want in the first version of the
  dictionary? We have sixty; I suspect the real first cut is different."
- "Would a competency statement from a system like this be acceptable as an APAR input, or
  does it need a human attestation step first?"
- "What is the realistic path to an iGOT API key for a system like this — Karmayogi Bharat
  directly, or through a sponsoring ministry?"
