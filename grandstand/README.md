# GRANDSTAND — Trivia Athletic

A turn-based sports-quiz RPG for people who remember when *Grandstand* started
at twelve and finished when the football results came in.

You walk around a municipal sports complex. People who were on the telly in
1987 want a word. You settle it with a quiz — and **the answer you pick is the
damage you do**.

> *Who scored more Premier League goals — Robbie Fowler, Andy Cole, or Les Ferdinand?*
>
> Pick Cole (187) and you land 187 goals on his chin. Pick Ferdinand (149) and
> you still connect, just softer. There's no "wrong", only "soft".

Pixel graphics, no build step, plays in a browser on a phone.

---

## Playing it

```bash
cd grandstand
python3 -m http.server 8777     # or: npx serve . -l 8777
open http://localhost:8777
```

It's plain ES modules and one HTML file — no bundler, no framework, no install
needed to play. `npm install` is only for the browser playtest.

**Keys:** arrows/WASD move · `1` `2` `3` answer · `N` nutmeg · `Enter` continue
· `M` mute. On a phone: d-pad, swipe the map, tap the answers.

---

## The loop

**The day out (PvE).** A seeded sports complex — six venues, roughly fifteen
opponents, one boss behind the players' tunnel. Every step costs energy. Every
exchange costs energy. When the energy's gone the day's over and you get a
score. Half-time oranges, Lucozade and pies are lying about the place.

**The fight.** Turns alternate, and so does the question:

| Your turn | **STRIKE** | *"Who scored the MOST…"* | Pick the **biggest** number. It's your damage. |
| Their turn | **BLOCK** | *"Who scored the FEWEST…"* | Pick the **smallest** number to take the sting out. |

Getting those two the wrong way round at speed is the entire skill ceiling, and
it is a more interesting failure than not knowing the answer.

On top of that: a 12-second clock worth up to +50% damage, a combo multiplier
up to ×2 for perfect answers in a row, and a **yellow card** if you pick the
outright worst option. Two yellows and you sit an exchange out. Three
**nutmegs** a day knock a duff option off the board and leave you a 50:50.

**Hot-seat PvP.** Two players, one device, pass it across. Symmetric — no block
phase, you just take turns hitting each other with a number. A "pass the
device" screen sits in between so nobody reads over a shoulder.

**Sport filters.** Play everything, or just football, or just boxing and darts.
The filter applies to the overworld roster as well as the questions.

---

## Why the damage is normalised

Raw stat values are wildly different in scale — Tendulkar's 15,921 Test runs
versus the 5 Olympic rings. If the number were literally the damage, a cricket
question would one-shot a boss and a darts question would tickle him. So
damage is rank-normalised *within the question*:

```
ratio = 0.25 + 0.75 × (value − min) / (max − min)
```

Best answer is 1.00×, worst is 0.25×, whatever the units. The raw number is
still shown, big, because that's the fantasy — "260 GOALS" landing on someone's
chin. Full reasoning in [DESIGN.md](DESIGN.md).

---

## On the names

The opponents are affectionate fakes: Tank Bruno, Sally Gunner, Nigel
Moustachio, Eddie the Seagull, Daley Thompsen. Nobody real is depicted and no
likeness is used — the sprites are generated from a shared humanoid template
and a palette.

The **questions** are about real people and real records, which is different
and fine: sporting facts aren't anyone's property. But see the health warning
below.

---

## Keeping the bank honest

**The question bank has not been fact-checked by a human.** It was written from
memory and needs a verification pass before this goes anywhere near players.
Two principles are baked in and worth keeping:

1. **Prefer retired players and closed records.** A bank full of active players
   rots — every number is wrong within a season. Where a figure is a moving
   target it's marked approximate in the note.
2. **No ties.** Two options sharing the top value makes "the best answer"
   ambiguous and the damage maths wrong. `tools/validate.mjs` fails the build
   on this, and it caught eight of them the first time it ran.

A few entries are explicitly approximate (career totals, weeks at number one,
years on air) and say so in their note. Those are the ones to check first.

---

## Tools

```bash
npm run validate   # content checks: ties, units, prompt direction, coverage
npm run balance    # simulate thousands of fights at four skill levels
npm run playtest   # drive a real browser through a whole run + a PvP match
```

`validate` is the one that matters. Data is what will break this game, not
code.

The balance curve it's tuned to — a fight is 2–6 rounds, tier 1 is a warm-up
that still costs you something, and the boss is roughly a coin flip for
somebody who genuinely knows their sport:

```
                           OPPONENT           WIN%   ROUNDS
pub quiz  (55% accurate)   EDDIE THE SEAGULL   100%     2.6
pub quiz  (55% accurate)   TANK BRUNO           94%     4.8
pub quiz  (55% accurate)   THE COMMENTATOR      47%     5.7
decent dad(70% accurate)   THE COMMENTATOR      77%     5.2
```

Note the sim starts every fight at full health. In a real run you arrive at the
boss already battered, so the felt difficulty is higher.

---

## Layout

```
index.html              shell, all the CSS, the retro chrome
src/
  main.js               boot, screens, input, the frame loop
  data/questions.js     98 questions — the content engine
  data/roster.js        20 opponents + player kits
  engine/render.js      canvas: map, battle scene, minimap, title
  engine/sprites.js     procedural pixel humans, no image assets
  engine/audio.js       WebAudio bleeps, no audio files
  engine/rng.js         seeded RNG so a day out can be shared
  game/map.js           seeded complex generator
  game/battle.js        turn-based combat and the damage model
  game/pvp.js           hot-seat match
  game/state.js         run state, scoring, localStorage
tools/                  validate · balance · playtest
```

No images, no audio files, no fonts of our own — the only external request is
two Google Fonts. Everything visual is drawn from code, which is why the whole
game is a few hundred kilobytes and why a new opponent costs about fifteen
lines.
