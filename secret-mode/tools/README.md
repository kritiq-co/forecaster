# tools

## community_scrape.py

Pulls player feedback from the Steam reviews API and Reddit, buckets it into ~20 request
categories, and ranks what a community is actually asking for — tagging each bucket with
the value-plan tier it speaks to (`T1 harvest`, `T2 recurring`, `T3 big bet`, `hygiene`,
`trust signal`).

Standard library only. No dependencies, no install.

```bash
python3 community_scrape.py --game backrooms --reviews 3000 --contact "you@kritiq.co"
python3 community_scrape.py --game chained   --reviews 3000 --contact "you@kritiq.co"
python3 community_scrape.py --appid 513710 --subreddits SCUM --reviews 2000
python3 community_scrape.py --game chained --days 90        # recent sentiment only
```

Writes `<game>_raw.csv` (every document, bucketed) and `<game>_ranked.md` (ranked table
plus verbatims) into `--out` (default `./out`).

**Status:** the classification, ranking and output path are tested. The network path is
unrun — this session's egress policy blocks Steam and Reddit, so it has never made a live
request. Expect to adjust: Steam occasionally changes review-API pagination, and Reddit's
public JSON endpoints increasingly want OAuth (if `/search.json` 403s, register a script
app and add a bearer token to `get()`).

Be a good citizen: pass `--contact`, leave the rate limiting alone.
