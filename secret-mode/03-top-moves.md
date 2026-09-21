# Top 3 value moves per title

> **On the scrape:** the scraper was run against both titles. Every Steam and Reddit call returned
> `403 Forbidden` from the egress proxy — an organisation policy denial, not a transient failure.
> **There are no scraped rankings, and nothing below is derived from counted community data.**
> These moves are reasoned from public search evidence (cited in `02-community-signals.md`) plus
> the value framework in `00-brief.md`. Run `tools/community_scrape.py` from an unblocked machine
> to test them against real volume — each move below names what would confirm or kill it.

---

## The portfolio-level finding (lead with this)

Look at the three titles side by side and **two repeatable playbooks fall out**:

| | Console expansion | UGC / mod support |
|---|---|---|
| **Escape the Backrooms** | ✅ Done — PS5/XSX May '26, Switch 2 Jul '26 | ❌ None official. Active Nexus scene. |
| **Chained Together** | ❌ None. PC only, 10M+ copies. | ✅ Shipped — map editor + Workshop (v1.8.4) |
| **SCUM** | 🔄 In development, long-delayed | 🔄 Mod framework in development, 2026 target |

**That table is the equity story.** Not "we have some games" but *"we have two playbooks, and here they are applied across three titles with measured results."* A buyer pays a multiple for a repeatable system and discounts a collection of one-offs. Each title is missing exactly the playbook the others have already proved — which means every gap in that grid is a costed, de-risked, evidenced move rather than a leap of faith.

It also solves the sequencing problem, because the gaps don't compete for the same people at the same time.

---

## Escape the Backrooms

**Its Tier 1 is largely spent.** Console is done across PS5, Xbox and Switch 2. That's the harvest banked — which means the next value has to come from Tier 2, and that changes what "good" looks like for this title.

### 1. Official Workshop and level editor · `T2 recurring` · **the biggest single move on this title**
Backrooms has no official UGC but a live Nexus modding scene — custom levels, loaders, skins, sounds, utilities — with modders publicly saying the lack of official support is what limits them.

Three things happen at once:
- **It fixes the content problem at the root.** The answer to "bland, buggy, short levels" is not more levels from a 20-person studio on a cadence. It's the community making them, with Sheffield curating, certifying and featuring. Content goes from a cost line to an engine.
- **It builds the only moat this IP can have.** Anyone can make a Backrooms game — that's the diligence risk. Nobody can replicate a creator community and a library of thousands of player-made levels. *Workshop is the moat.*
- **It's the second application of a playbook they've already proved** on Chained Together. That's what a buyer pays for.

*Precondition:* this is real engineering, not a toggle — editor UX, publishing, moderation, versioning against a game that keeps patching.
*Kill it if:* the Nexus scene turns out to be a handful of authors rather than a community. Check mod counts, unique authors, download curves before committing.

### 2. Raise the lobby cap · `T1/T2` · **cheapest unit-driver available**
`BiggerBackrooms` exists specifically to take the lobby from 4 to 16, with host management tools. A mod existing for a thing is a demand signal; a mod existing because the official cap frustrates people is a stronger one.

More players per lobby means more friends pulled in per session, which means more copies sold — and unlike anything else in Tier 2, **it renegotiates no promise with existing players.** Cheap, popular, directly unit-driving, near-zero trust risk. The rare move with no downside.

*Precondition:* netcode and performance at 8–16 players is the real work. Patch 1.3.2 was already fixing crashes and voice-comms failures in 4-player co-op, so the foundation needs attention first.

### 3. Resolve the roadmap question, and make progression the retention spine · `T2`
⚠️ **Public sources conflict on whether Part 5 is the final content update.** For a value plan that is not a detail — "is the flagship live title's content roadmap ending?" is a first-order question. Get a straight answer in the room.

Part 5 also reportedly adds a **player progression system**. Ask what it's *for*. If it's shipping as a feature rather than as the spine of retention and recurring engagement, that's a missed connection between the content roadmap and the value plan — and a cheap one to fix while it's still in playtesting.

If content genuinely is winding down, then **progression plus UGC is the entire answer** to keeping the asset alive without Sheffield feeding it forever. Which makes move 1 urgent rather than merely valuable.

---

## Chained Together

The most valuable and most fragile asset in the portfolio: 10M+ copies, $4.99, and a player relationship that has softened from ~90% to ~81%.

### 1. Console port · `T1 harvest` · **the highest cash-per-unit-of-risk move in the whole portfolio**
**No console version exists at all.** PC/Steam only, at 10M+ copies. Console audiences pay more for exactly this kind of couch and party co-op, and the title is a natural fit for the storefronts' co-op merchandising.

Anegar's stated blockers were graphics optimisation and online multiplayer hardware requirements — engineering an indie couldn't fund, and **precisely what Sheffield was created to do.** The first move of the value plan and the founding rationale of the studio are the same move. That is an unusually clean thing to be able to say to a board.

⚠️ *Scope this before anyone commits a date.* The Workshop is Steam-only. A port either ships **without the community content that is now part of the game's value**, or it needs console UGC plumbing — certification, moderation, storage, cross-platform sync. Three-month port versus nine-month project, and exactly the unscoped dependency that wrecks a capacity plan.

### 2. Decide the monetisation architecture — before Lab42's roadmap sets · `T2 recurring` · **the biggest judgement call they own**
Every option renegotiates a deal ten million people think closed at five dollars. Get it right and it's the most profitable thing in the portfolio; get it wrong and 90% becomes 60% in a fortnight and doesn't come back.

The shape that fits the evidence: **cosmetics and optional expansions, never paywalled core content or anything that touches the base loop.** The $5 promise was "this whole absurd thing, for a fiver, with your friends." Cosmetics don't break it. A paid map pack does — especially now that free community maps exist, which makes paid content look worse by comparison.

*This is the decision to bring evidence to, and the window is closing.* Lab42 is writing the roadmap now, and a new team inherits the codebase but not the instinct for what the game is.

### 3. Invest in the Workshop as the content engine · `T2 recurring`
It already exists — so this is compounding a proven asset, not building one. Creator tooling, curation, featured rotations, discovery, and a reason for makers to keep making.

It's cheaper than producing content, it's the strongest retention mechanic the game has, and it raises the value of both other moves: it makes a console port worth more (if the UGC question is solved) and it is the best possible evidence base for whether a sequel is warranted — because you can see what players build when you give them the tools.

**Precondition for 2 and 3:** the hygiene. Chain physics bugs in 4-player and the back-half difficulty cliff are very likely what the −9 is made of. Fix those first — you cannot scale monetisation on top of a co-op experience that breaks in the configuration most people play it in.

---

## SCUM

Different from the other two: **Secret Mode hasn't signed, doesn't own it, and the first move is diagnosis rather than action.**

### The reframe that matters
SCUM's 1.0 launched **17 June 2025** — which is exactly its all-time concurrent peak (~45.3k), immediately followed by the collapse to ~5.5k. The decay isn't slow erosion. **It's a botched 1.0**, and the developers have said so: negative reviews reflect disappointment with 1.0 over unmet expectations, bugs, unimplemented features and features needing rework. The drop from Mostly Positive to Mixed has been described as self-inflicted.

**That is a much more investable proposition than gradual decline.** 6M copies means demand is proven; the asset is *damaged*, not *dead*. Damaged assets with proven demand are exactly what a turnaround publisher should want — provided the damage is diagnosable and the price reflects it.

Named community grievances worth testing: pointless/irritating NPCs; turrets effectively unusable behind uranium gating; the Watchdog high-ping system penalising players while China (where a VPN is needed) goes unaddressed; bunker removal slowing progression; desync when driving; zombies clipping through walls; enemies spawning ~5m away. And cheating is a persistent, high-volume Steam discussion theme.

### 1. A pre-transition trust baseline — before signature · `diagnosis`
What is the 13-point gap between lifetime and recent actually made of? Which grievances are fixable in a patch cycle, which are structural design debt, and which are trust damage that outlives the fix?

This is the highest-value, best-timed work Kritiq could sell anyone right now: the decision isn't made, independence is the product with three parties each incentivised toward optimism, and it's **deal budget rather than operating budget.** If they proceed, the baseline becomes the yardstick for everything after.

### 2. Make the deal structure the negotiation, not the fee · `deal`
Apply their own Star Wars insight. **Publishing with no ownership is the licence problem in a different costume** — reputation and cash flow, real capacity consumed, no asset created. Worse here, because a persistent-world survival sim is the most operationally demanding thing they'd own, indefinitely, during exactly the window they need capacity for Chained Together and Backrooms.

So: is there equity, an IP stake, or a participation long enough that an acquirer inherits something real? And **who owns the player relationship** across Gamepires, Splash Damage and Secret Mode? On a title already in deficit, three parties with no single owner of the player relationship is the failure mode.

### 3. If they proceed: anti-cheat and server integrity first, then mod support · `T2 recurring`
- **Cheating is the highest-volume complaint theme and the most fixable.** Splash Damage's shooter and live-multiplayer expertise is directly on point — this is the clearest reason their involvement adds value rather than just headcount. It's also the fastest visible win, which matters enormously when you're trying to reverse a trust curve: players need to see that the new regime is different.
- **Mod support is already in development with a 2026 target.** That's the third instance of the UGC playbook, and on a survival sim with a private-server ecosystem it's worth more than on either other title — modded and community servers are how games in this genre sustain for a decade.
- **Console remains in development and long-delayed.** Real Tier 1 upside, but do not touch it until the trust curve turns. Shipping a damaged game to two new audiences just distributes the damage.

---

## Sequencing across shared capacity

One big bet at a time, drawn against Sheffield's 3 → ~20 ramp. The gaps in the playbook grid conveniently don't collide:

| When | Big bet (senior attention) | Running in parallel (low decision load) |
|---|---|---|
| **Now – Q1** | **Chained Together console port** — biggest cash, Sheffield's core competence, scope the UGC question first | Backrooms hygiene + lobby cap. SCUM diagnosis (external, no studio time). Galactic Racer launch. |
| **Q2 – Q3** | **Backrooms Workshop** — the second application of the proven playbook | CT monetisation architecture decision (evidence-led). SCUM anti-cheat if signed. |
| **Q4+** | The big bet — sequel, on whichever IP the evidence by then supports | Compound the Workshops. Console for SCUM once trust turns. |

**The discipline isn't doing less. It's never having two things that need the same scarce attention.**
