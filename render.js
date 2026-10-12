// usage: node render.js stills t1,t2,... [scenes.json]   |   node render.js video out.mp4 [scenes.json]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
(async () => {
  const [mode, arg, scenesFile = path.join(__dirname, 'scenes.json')] = process.argv.slice(2);
  const scenes = JSON.parse(fs.readFileSync(scenesFile, 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => { console.error('Template error: ' + e.message); process.exit(1); });
  await page.addInitScript(s => { window.SCENES = s; }, scenes);
  await page.goto('file://' + path.join(__dirname, "template", (scenes.template || "discount") + ".html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  if (mode === 'stills') {
    for (const t of arg.split(',')) {
      await page.evaluate(t => render(t), +t);
      await page.screenshot({ path: path.join(__dirname, "output", `still_${t}.jpg`), type: 'jpeg', quality: 80 });
    }
  } else {
    const fps = 30, dur = await page.evaluate(() => DURATION), out = arg;
    console.log(`Rendering ${dur.toFixed(1)} s (${Math.round(fps * dur)} frames) -> ${out}`);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < Math.round(fps * dur); f++) {
      await page.evaluate(t => render(t), f / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
