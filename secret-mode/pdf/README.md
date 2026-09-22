# PDF build

`proposal-print.html` is the print source. It links Google Fonts by URL, which Chromium
in this environment cannot fetch (it does not trust the egress proxy CA), so the build
inlines static TTFs as data URIs first.

```bash
# 1. fetch static TTFs (legacy UA forces static files, not variable woff2 -
#    Chromium here fails to apply the variable woff2 faces) and base64 them
#    into a fonts.css, stripping font-stretch.
# 2. swap the <link> in proposal-print.html for that <style> block.
# 3. render:
/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --virtual-time-budget=10000 \
  --print-to-pdf=Kritiq-SecretMode-Proposal.pdf \
  proposal-print-embedded.html
```

`--no-pdf-header-footer` matters: without it Chromium stamps the file path and date
across the top and bottom of every page.

**Branding caveat:** kritiq.co is blocked from this environment, so the wordmark,
palette and type are a reasonable interpretation, not Kritiq's actual assets. Swap in
the real logo, colours and fonts before this goes out at scale.
