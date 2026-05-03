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
