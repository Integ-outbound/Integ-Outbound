const fs = require('node:fs/promises');
const path = require('node:path');

const sharp = require('sharp');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'assets', 'social', 'instagram', 'faq-highlight');

const W = 1080;
const H = 1920;
const CARD = { x: 72, y: 150, w: 936, h: 1620, r: 42 };
const CONTENT_X = CARD.x + 72;
const CONTENT_W = CARD.w - 144;

const COLORS = {
  bg: '#0B1220',
  card: '#111827',
  cardLift: '#151f31',
  violet: '#6366F1',
  blue: '#3B82F6',
  text: '#F7F8FB',
  body: '#94A3B8',
  border: 'rgba(148,163,184,0.22)'
};

const headingFont = "'Space Grotesk', 'Segoe UI', Arial, sans-serif";
const monoFont = "'IBM Plex Mono', Consolas, 'Courier New', monospace";

const slides = [
  {
    file: 'faq-00-cover.png',
    eyebrow: 'INTEG OUTBOUND',
    headline: 'FAQ',
    body: 'Answers to the questions agencies ask before starting outbound.',
    headlineSize: 110,
    bodySize: 50
  },
  {
    file: 'faq-01-guarantees.png',
    eyebrow: 'FAQ 01',
    headline: 'Do you guarantee clients?',
    body:
      'No fake guarantees. We build controlled outbound campaigns designed to create qualified sales conversations. Results depend on the offer, market, targeting, and follow-up.',
    headlineSize: 88,
    bodySize: 45
  },
  {
    file: 'faq-02-who-for.png',
    eyebrow: 'FAQ 02',
    headline: 'Who is Integ for?',
    body:
      'Agencies that want more client conversations without hiring a full outbound team. Best fit: paid media, PPC, growth, SEO, web, and B2B service firms.',
    headlineSize: 102,
    bodySize: 46
  },
  {
    file: 'faq-03-what-we-do.png',
    eyebrow: 'FAQ 03',
    headline: 'What do you actually do?',
    body:
      'We help define the target, build the prospect list, write the outreach, launch carefully, handle replies, and improve based on real market response.',
    headlineSize: 88,
    bodySize: 46
  },
  {
    file: 'faq-04-how-start.png',
    eyebrow: 'FAQ 04',
    headline: 'How do we start?',
    body:
      'Start with one focused pilot. Define the offer. Choose the market. Build the list. Launch carefully. Improve from replies. DM \u201cPILOT\u201d.',
    headlineSize: 104,
    bodySize: 48
  }
];

const expectedFiles = [...slides.map((slide) => slide.file), 'faq-preview.png'];

function esc(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text, maxWidth, fontSize, ratio = 0.52) {
  const maxChars = Math.floor(maxWidth / (fontSize * ratio));
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function textLines({ lines, x, y, fontSize, lineHeight, color, weight, family, letterSpacing = 0 }) {
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : fontSize * lineHeight;
      return `<tspan x="${x}" dy="${index === 0 ? 0 : dy}">${esc(line)}</tspan>`;
    })
    .join('');

  return `<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${letterSpacing}">${tspans}</text>`;
}

function brandMark(x, y, size) {
  const radius = Math.round(size * 0.315);
  const fontSize = Math.round(size * 0.34);
  const letterSpacing = Math.round(size * 0.03);

  return `
    <g>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#markGradient)" stroke="rgba(148,163,184,0.28)" stroke-width="1.5"/>
      <text x="${x + size / 2}" y="${y + size * 0.58}" text-anchor="middle" dominant-baseline="middle" fill="${COLORS.text}" font-family="${monoFont}" font-size="${fontSize}" font-weight="500" letter-spacing="${letterSpacing}">IN</text>
    </g>`;
}

function slideSvg(slide) {
  const headlineLines = wrapText(slide.headline, CONTENT_W, slide.headlineSize, 0.53);
  const bodyLines = wrapText(slide.body, CONTENT_W, slide.bodySize, 0.5);
  const eyebrowY = 288;
  const headlineY = 456;
  const bodyY = headlineY + headlineLines.length * slide.headlineSize * 0.98 + 82;
  const footerY = CARD.y + CARD.h - 122;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="pageGlow" cx="82%" cy="83%" r="48%">
        <stop offset="0%" stop-color="${COLORS.violet}" stop-opacity="0.2"/>
        <stop offset="38%" stop-color="${COLORS.blue}" stop-opacity="0.11"/>
        <stop offset="100%" stop-color="${COLORS.bg}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="cardGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${COLORS.cardLift}" stop-opacity="0.78"/>
        <stop offset="100%" stop-color="${COLORS.card}" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="markGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${COLORS.violet}" stop-opacity="0.26"/>
        <stop offset="100%" stop-color="${COLORS.violet}" stop-opacity="0.08"/>
      </linearGradient>
      <filter id="softBlur" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="44"/>
      </filter>
    </defs>

    <rect width="${W}" height="${H}" fill="${COLORS.bg}"/>
    <rect width="${W}" height="${H}" fill="url(#pageGlow)"/>
    <circle cx="1010" cy="1710" r="290" fill="${COLORS.violet}" opacity="0.13" filter="url(#softBlur)"/>
    <circle cx="920" cy="1810" r="250" fill="${COLORS.blue}" opacity="0.1" filter="url(#softBlur)"/>

    <rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="${CARD.r}" fill="url(#cardGradient)" stroke="${COLORS.border}" stroke-width="1.5"/>

    ${textLines({
      lines: [slide.eyebrow.toUpperCase()],
      x: CONTENT_X,
      y: eyebrowY,
      fontSize: 25,
      lineHeight: 1,
      color: COLORS.violet,
      weight: 500,
      family: monoFont,
      letterSpacing: 5
    })}

    ${textLines({
      lines: headlineLines,
      x: CONTENT_X,
      y: headlineY,
      fontSize: slide.headlineSize,
      lineHeight: 1.02,
      color: COLORS.text,
      weight: 700,
      family: headingFont
    })}

    ${textLines({
      lines: bodyLines,
      x: CONTENT_X,
      y: bodyY,
      fontSize: slide.bodySize,
      lineHeight: 1.35,
      color: COLORS.body,
      weight: 400,
      family: headingFont
    })}

    ${brandMark(CONTENT_X, footerY - 30, 54)}
    <text x="${CONTENT_X + 76}" y="${footerY + 5}" dominant-baseline="middle" fill="${COLORS.body}" font-family="${headingFont}" font-size="30" font-weight="500">integ-outbound.com</text>
  </svg>`;
}

async function cleanStaleFaqPngs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const entries = await fs.readdir(OUT_DIR, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.endsWith('.png') && !expectedFiles.includes(name))
      .map((name) => fs.unlink(path.join(OUT_DIR, name)))
  );
}

async function renderContactSheet(files) {
  const thumbW = 216;
  const thumbH = 384;
  const gap = 24;
  const pad = 24;
  const sheetW = pad * 2 + files.length * thumbW + (files.length - 1) * gap;
  const sheetH = pad * 2 + thumbH;

  const composites = [];
  for (const [index, file] of files.entries()) {
    const input = await sharp(file).resize(thumbW, thumbH).png().toBuffer();
    composites.push({
      input,
      left: pad + index * (thumbW + gap),
      top: pad
    });
  }

  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: COLORS.bg
    }
  })
    .composite(composites)
    .png()
    .toFile(path.join(OUT_DIR, 'faq-preview.png'));
}

async function renderSlides() {
  await cleanStaleFaqPngs();

  const rendered = [];
  for (const slide of slides) {
    const svg = slideSvg(slide);
    const outPath = path.join(OUT_DIR, slide.file);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    rendered.push(outPath);
  }

  await renderContactSheet(rendered);
}

async function verifyOutputs() {
  for (const file of expectedFiles) {
    const fullPath = path.join(OUT_DIR, file);
    const meta = await sharp(fullPath).metadata();
    console.log(`${file} ${meta.width}x${meta.height}`);

    if (file !== 'faq-preview.png' && (meta.width !== W || meta.height !== H)) {
      throw new Error(`${file} must be ${W}x${H}; got ${meta.width}x${meta.height}`);
    }
  }
}

async function main() {
  await renderSlides();
  await verifyOutputs();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
