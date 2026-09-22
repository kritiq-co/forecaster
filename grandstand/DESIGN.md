# GRANDSTAND — design notes

Written down because the interesting decisions in this game are all in the
numbers, and numbers get changed by whoever touches the file last.

---

## 1. The core idea, and the trap in it

> *"Multiple choice where the answer is always a whole number. The answer the
> player picks is the hit points against the opponent."*

That's the pitch, and it's a good one, because it collapses two things into
one: the quiz answer and the combat roll are the same act. No "you answered
correctly, now roll for damage". You pick Alan Shearer and 260 goals go into
someone's ribs.

The trap is that **real sporting numbers have no common scale**:

| Question | Range |
|---|---|
| Test runs | 13,289 – 15,921 |
| Premier League goals | 149 – 260 |
| World darts titles | 3 – 16 |
| Olympic rings | 5 |

Taken literally, one cricket question ends any fight in the game and a snooker
question does nothing. You'd have to either restrict the bank to questions
whose numbers happen to sit in a combat-friendly range — which throws away most
of the good trivia — or normalise.

**We normalise, within the question:**

```
ratio = 0.25 + 0.75 × (value − min) / (max − min)
damage = power × ratio × (1 + speed) × combo × (perfect ? 1.5 : 1)
```

Best answer 1.00×, worst 0.25×, regardless of units. The floor of 0.25 rather
than 0 matters: **there is no wrong answer, only a soft one.** A dad who thinks
Fowler outscored Cole still lands a punch. That's the difference between a quiz
that punishes you and a quiz that lets you play.

The raw number is still the hero of the presentation — "ANDY COLE — 187 GOALS
→ 42 DAMAGE" — so the fantasy survives the arithmetic underneath it.

**Consequence:** ties are a content bug, not a curiosity. If two options share
the top value, "the best answer" is ambiguous and the normalisation divides by
a smaller range than it should. `tools/validate.mjs` fails on ties. It found
eight on its first run.

---

## 2. Alternating MOST and FEWEST

The obvious design is: you answer, you hit; they attack, you take it. That's
half a game — the opponent's turn is something that happens *to* you.

Instead every opponent turn is a **BLOCK**: the same question format, flipped.
*"Who scored the FEWEST…"* Pick the smallest number and you take 25% of the
incoming hit; pick the biggest and you wear all of it.

This does three things:

1. **You're never idle.** Every turn in the fight is a decision.
2. **It creates a skill ceiling that isn't knowledge.** Knowing that Shearer
   got 260 is trivia. Remembering *which way round you're being asked* while a
   12-second clock runs down is a game. Experienced players fail here, not on
   the facts, which is exactly where you want a quiz game's difficulty to live.
3. **It doubles the bank for free.** 98 questions, 196 prompts.

Because the block prompt is the one the player reads in isolation, it has to
stand alone. Writing both by hand produced 55 prompts reading *"Who won
FEWER?"* with no noun in them. The block prompt is now **derived** from the
strike prompt by word substitution (`MOST`→`FEWEST`, `MORE`→`FEWER`, `OLDEST`→
`YOUNGEST`, `MOST recently`→`EARLIEST`). Write one good sentence, get two.

The UI also states the direction under every question — *PICK THE BIGGEST
NUMBER TO HIT HARDEST*. Confusing the two should be a lapse of concentration,
never a failure of the interface.

---

## 3. Why an energy budget rather than lives

> *"Keep moving around map until you run out of energy."*

Energy is a much better run-limiter than health for this audience, because it
makes **walking a cost**. You can't grind the easy opponents to farm rep: every
step across the car park is a step you don't get back. So the actual decision
loop is "is that boxer over there worth the twelve steps and five exchanges, or
do I push on to the arena?" That's a strategy layer sitting on top of a quiz,
and it costs nothing to implement.

Health (`CONDITION`) still exists, but losing a fight doesn't end the day — it
costs you 20 energy and drops you to 30%. Getting beaten by Tank Bruno should
be a setback, not a game over. Forty-something dads play in twenty-minute
windows; a run that ends abruptly at minute four is a run they don't restart.

A day out is about 110 steps and 7–9 fights. Roughly twenty minutes.

---

## 4. Cards, combos, nutmegs

Three modifiers, each doing a specific job:

- **The clock (+50% max)** stops the optimal play from being "sit and think for
  a minute". It decays linearly, so there's a real speed/accuracy trade.
- **Combos (up to ×2)** reward a run of perfect answers and make a strong
  player's fight *visibly* shorter. Streaks are what make a quiz feel good.
- **Cards** punish only the *outright worst* pick — not a middling one. Two
  yellows is a red and you sit an exchange out. It's the one genuinely punitive
  mechanic, and it's aimed at guessing rather than being wrong.
- **Nutmegs (3 a day)** remove one duff option for a 50:50. A knowledge game
  needs an escape hatch, or a question you simply don't know is dead air. The
  scarcity is the decision: burn one on Sally Gunner or save it for the boss.

---

## 5. Pixel art without any art

Every sprite is generated: one humanoid template, a four-colour palette per
fighter (skin / kit / trim / hair), a build (lean, normal, heavy) and one held
item. Twenty distinct-looking opponents, no image files, and a new one costs
about fifteen lines of data.

This is a deliberate production choice, not just a shortcut. A solo project
that needs twenty commissioned sprite sheets before it's playable is a project
that never gets playtested. This one was balanced against a simulation before
it had a single asset.

**The rendering rule that matters:** the internal canvas is a fixed 320×180 and
everything is drawn at whole-pixel coordinates. Battle sprites are drawn at
exactly 2×. The one place we knowingly break purity is the final scale-to-fit:
snapping to whole-number scales would mean scale 1 on a 420px phone — a
postage stamp in a black frame. We fit the space and let
`image-rendering: pixelated` do the snapping. Some source pixels end up a
device pixel wider than their neighbours. Nobody notices that; everybody
notices a tiny picture.

---

## 6. What's deliberately not built

**Online PvP.** The brief asks for PvP and this ships hot-seat only. Online
competitive trivia needs a server, an account system, matchmaking, and —
critically — **anti-cheat for a game where the answer is one search away**.
That last one isn't a feature, it's the entire design problem: any real-time
online quiz has to assume a second device. The honest routes are asynchronous
(both players answer the same seeded set, compare after) or a much shorter
clock. Both are real work and neither is a prototype. Hot-seat is what two
people in a pub will actually use anyway.

**Persistent progression.** Rep and a league table persist; nothing else does.
Meta-progression (permanent upgrades between runs) is the obvious next hook,
and deliberately absent until the core fight is proven fun. Adding upgrades to
an unproven loop just hides whether the loop works.

**Audio beyond bleeps.** WebAudio square waves and noise. Music would be a
licensing conversation, and this doesn't need one yet.

---

## 7. The bit that will actually decide whether this works

Not the combat maths. **The question bank.**

98 questions is a demo. A player doing 7 fights a day at ~8 questions a fight
sees ~56 in a session — more than half the bank in one sitting. The repeat is
noticeable on day two.

Rough targets:

- **500** to stop within-session repeats being obvious
- **2,000+** for a game someone plays for a month
- **Per-sport minimum of ~80**, or the sport filters are a trap: picking
  "darts only" currently gives you five questions and a bad time. `validate.mjs`
  warns below a floor for exactly this reason.

That's a content job, not an engineering one, and it's the thing to cost
properly before anything else. The format is deliberately cheap to write to —
sport, one sentence, three names, three whole numbers, one line of colour — and
`validate.mjs` will catch the ties and the missing units automatically.

The 40-something dad audience is also unusually unforgiving here: they will
know when a number is wrong, and they will tell you. Get the bank verified.
