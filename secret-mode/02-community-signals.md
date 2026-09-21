# Community signals — Escape the Backrooms & Chained Together

## Method, honestly

**I could not scrape.** This session's egress policy blocks `store.steampowered.com`, `steamcommunity.com`, `api.steampowered.com`, `reddit.com`, `old.reddit.com`, Pushshift and the fan wikis — every endpoint returned a policy denial, not a transient error. That's an organisation-level network restriction I shouldn't route around.

So this file is **two things**:

1. **§1–2: what public web search could establish**, with confidence marked. Search-derived, not systematically sampled — no counts, no ranking by volume. Do not present any of it as "we analysed N reviews."
2. **`tools/community_scrape.py`: the actual instrument.** Stdlib-only Python, runs on any unblocked machine, pulls the Steam reviews API + Reddit, buckets every document into request categories, and ranks them — **tagging each bucket with the value-plan tier it speaks to.** Run it tonight and you'll have the real numbers for tomorrow. The classify/rank/output path is tested; only the network half is unrun here.

The tool is arguably the better thing to have in the room anyway. It makes "let's get the community helping us build the plan" a demonstrable method rather than an intention.

---

## 1. Chained Together

| Finding | Confidence |
|---|---|
| **PC/Steam only. No console version exists.** Anegar's FAQ: "focusing on the Steam version, other platforms under consideration." Stated blockers were graphics optimisation and online multiplayer hardware requirements. | High |
| **Steam Workshop + integrated map editor shipped in v1.8.4.** Reachable from the main menu; players place and adjust objects, design environments, add triggers, publish directly, and subscribe to others' maps. | High |
| Before the editor shipped, "more maps" was the dominant community ask. UGC largely answers it. | Medium |
| Players asked for an **expanded save/checkpoint system** to skip sections they'd already cleared repeatedly — enough that a savepoint mod existed. | Medium |
| Known friction: **chain physics bugs in 4-player**, difficulty cliff in the back half. | Medium |
| Steam announcements now come from Secret Mode; new dev team working on a roadmap. | High |

## 2. Escape the Backrooms

| Finding | Confidence |
|---|---|
| **No official Workshop or level editor.** An active unofficial scene on Nexus Mods — custom levels, loaders, skins, sounds, utilities. Modders report that the lack of official mod support makes things hard to build. | High |
| **`BiggerBackrooms` raises the lobby cap from 4 to 16** and gives the host extra lobby-management tools. A mod existing for this is a demand signal. | Medium |
| Community read is that an official workshop isn't close, because the team is still shipping levels. | Medium |
| **Part 5** in playtesting: Level 974 Kitty's House, You Cheated, Grassrooms, a reworked Level 3 Electrical Station, The Hub (central lobby/navigation), plus level reworks, new items — and **a player progression system**. | Medium |
| ⚠️ **Sources conflict on whether Part 5 is the final content update.** One Steam discussion frames it as the last; another source explicitly says it isn't. **Worth asking directly — "is the flagship live title's content roadmap ending?" is a material question for a value plan.** | Low — verify |
| Substantial performance work done: low-settings overhaul (~50–100% uplift), lighting engine (~10–15% on mid-range). | Medium |
| Patch 1.3.2 fixed crashes and **voice-comms failures that made co-op unreliable, particularly cross-platform**. | Medium |
| Persistent content-quality criticism: updates feel "bland, buggy, short" — one level reportedly ~10 minutes. | Medium |

---

## 3. What this changes in the plan

### A. Chained Together has no console version. That's the headline.
**10M+ copies, $4.99, PC only.** The single largest untapped surface in the portfolio, and it's pure Tier 1 — it monetises demand that already exists without touching the game or renegotiating the $5 promise. Console audiences pay more for exactly this kind of party co-op.

And the original blocker works in Secret Mode's favour: Anegar cited optimisation and netcode. That's engineering, which is precisely what a small indie couldn't fund and what **Sheffield was built to do**. The value plan's first move and the studio's founding rationale are the same move.

### B. They already have proof the UGC playbook works — and an obvious place to repeat it
Chained Together ships a map editor and Workshop. Escape the Backrooms has no official UGC but a live Nexus modding scene proving the appetite.

Porting that playbook from one title to the other is **exactly the "evidence the playbook repeats" that drives a multiple** — a buyer pays for a second successful application, not a first.

It also solves the Backrooms content problem at the root. The answer to "bland, buggy, short levels" is not more levels from a 20-person studio on a cadence. It's **letting the community make them**, and having Sheffield curate, certify and ship the best ones. That converts content from a cost line into an engine, and it's the difference between a treadmill and an annuity.

### C. UGC is the answer to the Backrooms defensibility problem
Anyone can make a Backrooms game — that's the diligence risk flagged in the brief. Nobody else can replicate **a creator community and a library of thousands of player-made levels**. The moat isn't the concept, it's the ecosystem. Workshop *is* the moat, and that reframes it from a feature request into an IP-value investment.

### D. ⚠️ The console × UGC tension — name this before anyone scopes the port
Chained Together's Workshop is Steam-only. A console port either ships **without the community content that is now part of the game's value proposition**, or it needs console UGC plumbing — certification, moderation, storage, cross-platform sync. That's the difference between a three-month port and a nine-month project, and it's exactly the kind of unscoped dependency that blows a capacity plan.

Get it on the table early. It's a genuinely useful thing to surface, and it's the sort of detail that proves you've actually looked.

### E. Lobby size is a monetisation-safe growth lever
The 4→16 mod on Backrooms is a demand signal worth taking seriously. Bigger lobbies mean more friends per session, which means more units sold — and unlike anything in Tier 2, it doesn't renegotiate a promise with existing players. Cheap, popular, unit-driving.

### F. Ask what the progression system in Part 5 is *for*
A progression system is retention and recurring-revenue groundwork. If it's shipping as a feature rather than as the foundation of a monetisation or engagement model, that's a missed connection between the content roadmap and the value plan — and an easy, concrete thing to fix.

---

## 4. Run the real thing

```bash
cd secret-mode/tools
python3 community_scrape.py --game backrooms --reviews 3000 --contact "you@kritiq.co" --out ./out
python3 community_scrape.py --game chained   --reviews 3000 --contact "you@kritiq.co" --out ./out

# any other title:
python3 community_scrape.py --appid 513710 --subreddits SCUM --reviews 2000 --out ./out
# recent sentiment only:
python3 community_scrape.py --game chained --days 90 --reviews 2000 --out ./out
```

Per title it writes:
- `<game>_raw.csv` — every document with its buckets, date, votes, playtime, link
- `<game>_ranked.md` — the ranked table plus **verbatims**, which is the half that actually moves a room

**How it ranks.** Twenty request categories by regex, then each document is checked for *explicit-ask* phrasing ("please add", "we need", "I wish", "why is there no"). Asks are weighted 3× a bare mention, plus a small weight for upvotes — because someone requesting a thing is much stronger evidence than someone happening to mention it. Every bucket carries its value-plan tier: `T1 harvest`, `T2 recurring`, `T3 big bet`, `hygiene`, `trust signal`.

**Caveats worth stating if you show output in the room:** English-language reviews only by default; Steam's `recent` filter skews to the current patch; Reddit's public JSON is rate-limited and may need OAuth; and regex buckets will mis-file sarcasm. It's a triage instrument, not a verdict — the verbatims are the evidence, the counts are the index.

**The point to make with it:** the tiering isn't a Kritiq framework imposed on their community. It's their community's own requests, sorted into the order that creates the most value. *They're already telling you the sequence.*
