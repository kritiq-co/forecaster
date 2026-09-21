#!/usr/bin/env python3
"""
Pull player feedback for a Steam title from the Steam reviews API and Reddit,
bucket it into request categories, and rank what the community is actually asking for.

Standard library only — no pip install. Runs on any machine with network access.

    python3 community_scrape.py --game backrooms --reviews 3000 --out ./out
    python3 community_scrape.py --game chained  --reviews 3000 --out ./out
    python3 community_scrape.py --appid 513710 --subreddits SCUM --reviews 2000 --out ./out

Outputs, per game:
    <out>/<game>_raw.csv        every document, with its buckets
    <out>/<game>_ranked.md      ranked buckets, with verbatims
"""

import argparse, csv, json, os, re, sys, time, urllib.parse, urllib.request
from collections import defaultdict
from datetime import datetime, timezone

UA = "kritiq-community-research/1.0 (contact: set --contact)"

GAMES = {
    "backrooms": {
        "appid": 1943950,
        "name": "Escape the Backrooms",
        "subreddits": ["EscapeTheBackrooms", "backrooms", "CoOpGaming"],
        "queries": ["escape the backrooms"],
    },
    "chained": {
        "appid": 2567870,
        "name": "Chained Together",
        "subreddits": ["ChainedTogether", "CoOpGaming"],
        "queries": ["chained together"],
    },
}

# ---------------------------------------------------------------- taxonomy
# Order matters only for readability. A document can land in several buckets.
BUCKETS = {
    "console_port":        r"\b(console|ps5|ps4|playstation|xbox|series ?[sx]|switch ?2?|steam ?deck)\b",
    "controller_support":  r"\b(controller|gamepad|joystick|dualsense|remap|rebind)\b",
    "ugc_workshop":        r"\b(workshop|level editor|map editor|custom (map|level)s?|ugc|mod(ding| support|s)?|nexus)\b",
    "more_content":        r"\b(more (levels?|maps?|content|entities|monsters)|new (levels?|maps?|content)|dlc|expansion|update with)\b",
    "lobby_size":          r"\b(lobby|player cap|more players|[5-9]\+? players|(six|eight|ten|sixteen) players|party size)\b",
    "performance":         r"\b(fps|frame ?rate|stutter|lag(gy|ging)?|optimi[sz]|performance|loading (time|screen))\b",
    "bugs_crashes":        r"\b(bug(s|ged)?|crash(es|ing|ed)?|glitch|broken|softlock|soft-lock|freeze|desync)\b",
    "netcode":             r"\b(netcode|desync|rubber ?band|host migration|connection|disconnect|p2p|dedicated server|ping)\b",
    "save_checkpoints":    r"\b(save|checkpoint|autosave|progress lost|restart from)\b",
    "difficulty_balance":  r"\b(too (hard|easy)|difficulty|balanc|unfair|rng|frustrat)\b",
    "progression":         r"\b(progression|unlock|level up|xp|achievement|replayab|endgame|grind|repetitive)\b",
    "cosmetics":           r"\b(cosmetic|skin|customi[sz]|outfit|suit|emote)\b",
    "price_monetisation":  r"\b(price|pricing|worth (it|the)|expensive|cheap|dlc cost|microtransaction|battle ?pass|paid)\b",
    "cross_platform":      r"\b(cross ?play|cross ?platform|cross ?save|crossprogress)\b",
    "voice_comms":         r"\b(voice ?chat|proximity (chat|voice)|vc|mic|push to talk)\b",
    "localisation":        r"\b(translat|localis|localiz|language|russian|chinese|portugu|spanish|german)\b",
    "content_quality":     r"\b(short|bland|empty|lazy|rushed|filler|low ?effort|10 minutes|not worth|reused? asset)\b",
    "sequel":              r"\b(sequel|part 2|chained together 2|second game|next game)\b",
    "mobile_vr":           r"\b(mobile|android|ios|vr|quest|oculus)\b",
    "anti_cheat":          r"\b(cheat(er|ing)?|hack(er|ing)?|exploit|anti-?cheat|griefer|grief)\b",
}
BUCKETS = {k: re.compile(v, re.I) for k, v in BUCKETS.items()}

# Which tier of the value plan each bucket speaks to.
TIERS = {
    "console_port": "T1 harvest", "controller_support": "T1 harvest",
    "cross_platform": "T1 harvest", "localisation": "T1 harvest",
    "price_monetisation": "T1 harvest", "mobile_vr": "T1 harvest",
    "ugc_workshop": "T2 recurring", "more_content": "T2 recurring",
    "cosmetics": "T2 recurring", "progression": "T2 recurring",
    "lobby_size": "T2 recurring",
    "sequel": "T3 big bet",
    "performance": "hygiene", "bugs_crashes": "hygiene", "netcode": "hygiene",
    "save_checkpoints": "hygiene", "difficulty_balance": "hygiene",
    "voice_comms": "hygiene", "anti_cheat": "hygiene",
    "content_quality": "trust signal",
}

# A request is a stronger signal than a mention. These phrasings mark intent.
ASK = re.compile(
    r"\b(please add|please make|would love|i wish|it needs|we need|should (add|have|be)|"
    r"hope(fully)? (they|you)|add (a|an|more)|why (is there )?no|wish (it|there|they)|"
    r"asking for|request|suggestion|devs?,? ?(please|add))\b", re.I)


def get(url, tries=4, pause=1.2):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:
            if attempt == tries - 1:
                print(f"  ! giving up on {url[:90]}: {e}", file=sys.stderr)
                return None
            time.sleep(pause * (2 ** attempt))
    return None


def steam_reviews(appid, want, review_type="all", day_range=None):
    """Steam's public review API. Paginates via cursor."""
    out, cursor, seen = [], "*", set()
    while len(out) < want:
        params = {
            "json": 1, "filter": "recent", "language": "english",
            "review_type": review_type, "purchase_type": "all",
            "num_per_page": 100, "cursor": cursor,
        }
        if day_range:
            params["day_range"] = day_range
        url = f"https://store.steampowered.com/appreviews/{appid}?" + urllib.parse.urlencode(params)
        data = get(url)
        if not data or not data.get("reviews"):
            break
        for rv in data["reviews"]:
            rid = rv.get("recommendationid")
            if rid in seen:
                continue
            seen.add(rid)
            out.append({
                "source": "steam",
                "id": rid,
                "text": rv.get("review", ""),
                "created": datetime.fromtimestamp(rv.get("timestamp_created", 0), timezone.utc).date().isoformat(),
                "score": rv.get("votes_up", 0),
                "positive": rv.get("voted_up"),
                "hours": round((rv.get("author", {}).get("playtime_forever", 0)) / 60, 1),
                "url": f"https://steamcommunity.com/profiles/x/recommended/{appid}/",
            })
        nxt = data.get("cursor")
        if not nxt or nxt == cursor:
            break
        cursor = nxt
        time.sleep(0.8)
        print(f"  steam: {len(out)} reviews", file=sys.stderr)
    return out[:want]


def reddit_search(subreddits, queries, want=600):
    """Public Reddit JSON. If it 403s, set --reddit-token (see --help)."""
    out, seen = [], set()
    targets = [(s, q) for s in subreddits for q in queries] + [(s, None) for s in subreddits]
    for sub, q in targets:
        after, pulled = None, 0
        while pulled < want // max(len(targets), 1) + 100:
            if q:
                base = f"https://www.reddit.com/r/{sub}/search.json"
                params = {"q": q, "restrict_sr": 1, "sort": "new", "limit": 100, "t": "year"}
            else:
                base = f"https://www.reddit.com/r/{sub}/new.json"
                params = {"limit": 100}
            if after:
                params["after"] = after
            data = get(base + "?" + urllib.parse.urlencode(params))
            if not data:
                break
            children = data.get("data", {}).get("children", [])
            if not children:
                break
            for c in children:
                d = c.get("data", {})
                if d.get("id") in seen:
                    continue
                seen.add(d["id"])
                text = (d.get("title", "") + "\n" + (d.get("selftext") or "")).strip()
                if not text:
                    continue
                out.append({
                    "source": f"reddit/r/{sub}",
                    "id": d.get("id"),
                    "text": text,
                    "created": datetime.fromtimestamp(d.get("created_utc", 0), timezone.utc).date().isoformat(),
                    "score": d.get("score", 0),
                    "positive": "",
                    "hours": "",
                    "url": "https://reddit.com" + d.get("permalink", ""),
                })
                pulled += 1
            after = data.get("data", {}).get("after")
            if not after:
                break
            time.sleep(1.5)
        print(f"  reddit r/{sub} ({q or 'new'}): {pulled}", file=sys.stderr)
    return out


def classify(docs):
    for d in docs:
        t = d["text"]
        d["buckets"] = sorted(b for b, rx in BUCKETS.items() if rx.search(t))
        d["is_ask"] = bool(ASK.search(t))
    return docs


def rank(docs):
    agg = defaultdict(lambda: {"n": 0, "asks": 0, "score": 0, "samples": []})
    for d in docs:
        for b in d["buckets"]:
            a = agg[b]
            a["n"] += 1
            a["asks"] += 1 if d["is_ask"] else 0
            a["score"] += int(d.get("score") or 0)
            if d["is_ask"] and len(a["samples"]) < 6:
                snippet = " ".join(d["text"].split())[:260]
                a["samples"].append((int(d.get("score") or 0), d.get("source", ""),
                                 d.get("created", ""), snippet, d.get("url", "")))
    rows = []
    for b, a in agg.items():
        # Rank on explicit asks first — a mention is weaker evidence than a request.
        weight = a["asks"] * 3 + a["n"] + (a["score"] / 50.0)
        rows.append({
            "bucket": b, "tier": TIERS.get(b, "-"), "mentions": a["n"], "asks": a["asks"],
            "votes": a["score"], "weight": round(weight, 1),
            "samples": sorted(a["samples"], reverse=True),
        })
    return sorted(rows, key=lambda r: r["weight"], reverse=True)


def write(out_dir, key, name, docs, rows):
    os.makedirs(out_dir, exist_ok=True)
    raw = os.path.join(out_dir, f"{key}_raw.csv")
    with open(raw, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["source", "id", "created", "score", "positive", "hours", "is_ask", "buckets", "url", "text"])
        for d in docs:
            w.writerow([d.get("source",""), d.get("id",""), d.get("created",""), d.get("score",""),
                        d.get("positive",""), d.get("hours",""), int(d["is_ask"]),
                        "|".join(d["buckets"]), d.get("url",""), " ".join(d["text"].split())])

    md = os.path.join(out_dir, f"{key}_ranked.md")
    total = len(docs)
    asks = sum(1 for d in docs if d["is_ask"])
    with open(md, "w", encoding="utf-8") as f:
        f.write(f"# {name} — what the community is asking for\n\n")
        f.write(f"_{total} documents, {asks} containing an explicit request. "
                f"Generated {datetime.now(timezone.utc).date().isoformat()}._\n\n")
        f.write("| # | Request | Tier | Asks | Mentions | Upvotes |\n|---|---|---|---|---|---|\n")
        for i, r in enumerate(rows[:20], 1):
            f.write(f"| {i} | {r['bucket'].replace('_',' ')} | {r['tier']} | {r['asks']} | "
                    f"{r['mentions']} | {r['votes']} |\n")
        f.write("\n---\n\n## Verbatims\n\n")
        for r in rows[:12]:
            f.write(f"### {r['bucket'].replace('_',' ')} — {r['tier']}\n\n")
            for sc, src, created, snip, url in r["samples"]:
                f.write(f"- **[{sc}] {src} · {created}** — “{snip}” — [link]({url})\n")
            f.write("\n")
    print(f"\n  -> {raw}\n  -> {md}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--game", choices=list(GAMES), help="preset title")
    p.add_argument("--appid", type=int, help="any Steam appid (with --subreddits)")
    p.add_argument("--subreddits", nargs="*", default=[])
    p.add_argument("--queries", nargs="*", default=[])
    p.add_argument("--reviews", type=int, default=2000, help="Steam reviews to pull")
    p.add_argument("--reddit", type=int, default=600, help="Reddit posts to pull (0 to skip)")
    p.add_argument("--days", type=int, default=None, help="limit Steam reviews to the last N days")
    p.add_argument("--contact", default="", help="contact string for the User-Agent (be a good citizen)")
    p.add_argument("--out", default="./out")
    a = p.parse_args()

    global UA
    if a.contact:
        UA = f"kritiq-community-research/1.0 (contact: {a.contact})"

    if a.game:
        cfg = GAMES[a.game]
        key, appid, name = a.game, cfg["appid"], cfg["name"]
        subs = a.subreddits or cfg["subreddits"]
        qs = a.queries or cfg["queries"]
    elif a.appid:
        key, appid, name = str(a.appid), a.appid, str(a.appid)
        subs, qs = a.subreddits, a.queries or []
    else:
        p.error("pass --game or --appid")

    print(f"\n{name} (appid {appid})", file=sys.stderr)
    docs = steam_reviews(appid, a.reviews, day_range=a.days)
    if a.reddit and subs:
        docs += reddit_search(subs, qs, a.reddit)
    if not docs:
        print("No documents retrieved — check network access to store.steampowered.com "
              "and www.reddit.com.", file=sys.stderr)
        sys.exit(1)

    docs = classify(docs)
    write(a.out, key, name, docs, rank(docs))


if __name__ == "__main__":
    main()
