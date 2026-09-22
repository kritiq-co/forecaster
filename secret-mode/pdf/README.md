# PDF build

`kritiq-proposal.html` is the print source, built against the real Kritiq brand system
(`kritiq-brand-assets-reference-v3.html`, in the "Kritiq Brand" folder in Drive).

## Brand applied

| | |
|---|---|
| Sheet | Cream `#FFF8EE`, full bleed |
| Letterhead | Deep Green `#0D3D28` band, full bleed, gold flame + cream wordmark (primary lockup) |
| Accent | Gold `#FFD166`, only on green, per "gold on green is the signature combination" |
| Headings | Unbounded 700, −0.03em |
| Subheads / pull quote | Playfair Display italic |
| Body | DM Sans 400/500 |
| Labels, metadata, figures | Space Mono, 0.45em tracking, uppercase, Mid Green `#2D6A4F`, with the 16pt rule |
| Panels | Paper `#F2EBD9` for the outline box, Deep Green for the pull quote |
| Footer | "The whole machine, not the cogs" |

Logo is the flame SVG from the brand reference, `viewBox="26 0 104 148"`, ECG polyline at
stroke-width 13 (locked for digital up to ~100px flame height), clipped to the flame path.
Wordmark Unbounded 700 lowercase, 5px gap, flame hanging below the baseline per the lockup spec.

## Rendering

```bash
# 1. Fetch the four brand faces as static TTFs and base64 them into kritiq-fonts.css.
#    Use a legacy UA: the modern css2 endpoint serves variable woff2, which this
#    Chromium silently fails to apply (text falls back to DejaVu).
#    Strip font-stretch while you are there.
# 2. Substitute that CSS for the __FONTS__ token in kritiq-proposal.html.
# 3. Render:
/opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --disable-gpu --no-sandbox \
  --no-pdf-header-footer --virtual-time-budget=12000 \
  --print-to-pdf=Kritiq-SecretMode-Proposal.pdf kritiq-proposal-embedded.html
```

## Layout gotchas, all learned the hard way

- **`--no-pdf-header-footer` is required**, or Chromium stamps the file path and date on every page.
- **`@page { margin: 0 }` is required for the full-bleed band.** Chromium clips in-flow *and*
  fixed-position content to the page margin box, so neither negative margins nor a fixed
  backdrop will paint into a non-zero margin. The side and bottom inset comes from `.wrap`
  padding instead.
- **That leaves continuation pages with no top inset**, so the page break is placed
  deliberately: `.brk` on the pull panel forces the break and supplies its own 15mm top
  margin. If the copy changes length, check the break still lands there.
