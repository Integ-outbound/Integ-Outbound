const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ffmpegPath = require('ffmpeg-static');
const puppeteer = require('puppeteer-core');

const ROOT = process.cwd();
const HTML_PATH = path.join(ROOT, 'assets', 'video', 'integ-workflow-explainer-preview.html');
const OUT_PATH = path.join(ROOT, 'assets', 'video', 'integ-workflow-explainer.mp4');
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION_SECONDS = 39;
const FRAME_COUNT = FPS * DURATION_SECONDS;

function browserExecutablePath() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  return candidates.find((candidate) => {
    try {
      require('node:fs').accessSync(candidate);
      return true;
    } catch {
      return false;
    }
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data;
    });

    child.stderr.on('data', (data) => {
      stderr += data;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`${command} exited with ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

async function renderFrames(frameDir) {
  const executablePath = browserExecutablePath();
  if (!executablePath) {
    throw new Error('No local Edge or Chrome executable found for puppeteer-core.');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--font-render-hinting=none',
      '--hide-scrollbars'
    ],
    defaultViewport: {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1
    }
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.goto(`file://${HTML_PATH.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });

    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
      const ms = (frame / FPS) * 1000;
      await page.evaluate((time) => window.setRenderTime(time), ms);
      const file = path.join(frameDir, `frame-${String(frame).padStart(5, '0')}.png`);
      await page.screenshot({
        path: file,
        type: 'png',
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT }
      });

      if ((frame + 1) % 60 === 0 || frame + 1 === FRAME_COUNT) {
        console.log(`Rendered ${frame + 1}/${FRAME_COUNT} frames`);
      }
    }
  } finally {
    await browser.close();
  }
}

async function encodeVideo(frameDir) {
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.rm(OUT_PATH, { force: true });

  await run(ffmpegPath, [
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    path.join(frameDir, 'frame-%05d.png'),
    '-t',
    String(DURATION_SECONDS),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    OUT_PATH
  ]);
}

async function validateVideo() {
  const { stderr } = await run(ffmpegPath, [
    '-hide_banner',
    '-i',
    OUT_PATH,
    '-frames:v',
    '1',
    '-f',
    'null',
    '-'
  ]);
  const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  const resolutionMatch = stderr.match(/Video:.*?(\d{3,5})x(\d{3,5})/);
  const isH264 = /Video:\s*h264/i.test(stderr);
  const isYuv420p = /yuv420p/i.test(stderr);

  if (!durationMatch || !resolutionMatch) {
    throw new Error(`Could not parse FFmpeg validation output:\n${stderr}`);
  }

  const duration =
    Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
  const width = Number(resolutionMatch[1]);
  const height = Number(resolutionMatch[2]);

  if (width !== WIDTH || height !== HEIGHT) {
    throw new Error(`MP4 resolution must be ${WIDTH}x${HEIGHT}; got ${width}x${height}`);
  }

  if (duration < 30 || duration > 45 || Math.abs(duration - DURATION_SECONDS) > 0.02) {
    throw new Error(`MP4 duration must be ${DURATION_SECONDS}s within 30-45s; got ${duration}s`);
  }

  if (!isH264 || !isYuv420p) {
    throw new Error('MP4 must be H.264 with yuv420p pixel format.');
  }

  console.log(
    `Validated ${path.relative(ROOT, OUT_PATH)} ${width}x${height} ${duration.toFixed(3)}s h264 yuv420p`
  );
}

async function main() {
  const frameDir = await fs.mkdtemp(path.join(os.tmpdir(), 'integ-workflow-explainer-'));

  try {
    await renderFrames(frameDir);
    await encodeVideo(frameDir);
    await validateVideo();
  } finally {
    await fs.rm(frameDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stderr || error);
  process.exitCode = 1;
});
