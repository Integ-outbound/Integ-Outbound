# Video assets

## Integ brand video

The Integ brand video is generated deterministically from HTML and CSS. It does not use AI video generation, stock footage, generated imagery, external media, environment variables, or secrets.

Source files:

```text
assets/video/integ-brand-video.html
scripts/render-integ-brand-video.js
```

Generated output:

```text
assets/video/integ-brand-video.mp4
```

Regenerate from the repository root:

```bash
node scripts/render-integ-brand-video.js
```

The renderer opens the HTML file with `puppeteer-core`, samples the CSS keyframe animation at 30fps, writes temporary PNG frames outside the repo, and encodes them with `ffmpeg-static` as H.264 `yuv420p`.

Validation built into the script:

```text
resolution: 1080x1920
duration: 15 seconds
codec: H.264 via FFmpeg
pixel format: yuv420p
```

The preview HTML can also be opened directly in a browser for a quick visual check.

## Integ workflow explainer

The workflow explainer is a deterministic HTML/CSS animation rendered to MP4. It uses the same local browser plus FFmpeg render pipeline as the shorter brand video, but it is structured as a step-by-step product film. A blue/violet orb travels through each workflow stage and activates the matching visual node.

Source files:

```text
assets/video/integ-workflow-explainer-preview.html
scripts/render-integ-workflow-explainer.js
```

Generated output:

```text
assets/video/integ-workflow-explainer.mp4
```

Regenerate from the repository root:

```bash
node scripts/render-integ-workflow-explainer.js
```

Built-in validation:

```text
resolution: 1080x1920
duration: 39 seconds
codec: H.264 via FFmpeg
pixel format: yuv420p
```

The preview HTML can be opened directly in a browser. To tweak copy or timing, edit the scene text, scene delays, `--duration`, and `DURATION_SECONDS` together so the browser preview and renderer stay in sync.

Audio is not baked in. The animation is organized into clear scene beats so a soft ambient bed, orb pings, transition whooshes, activation thumps, or final reveal hit can be layered later in the final FFmpeg step.
