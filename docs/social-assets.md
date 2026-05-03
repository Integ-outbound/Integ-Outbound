# Social assets

## Instagram FAQ highlight stories

The FAQ highlight story assets are generated with deterministic code. The script renders SVG layouts to PNG with `sharp`; it does not use AI image generation, environment variables, external image assets, or secrets.

Output folder:

```text
assets/social/instagram/faq-highlight/
```

Regenerate the assets from the repository root:

```bash
node scripts/generate-instagram-faq-assets.js
```

The script creates these files:

```text
faq-00-cover.png
faq-01-guarantees.png
faq-02-who-for.png
faq-03-what-we-do.png
faq-04-how-start.png
faq-preview.png
```

Each story PNG is verified by the script as `1080x1920`. `faq-preview.png` is a horizontal contact sheet for quick review.

The design intentionally mirrors the public website brand system: deep navy background, large rounded dark card, thin border, violet uppercase eyebrow, bold white headline, slate body copy, subtle blue/violet bottom-right glow, and the existing `IN` nav mark treatment from the web app.
