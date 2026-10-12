// usage: node audio.js voice                 -> one voice file per scene, scene durations set from them
//                                                engine from scenes.json brand.voice {engine, name}: "kokoro" (free, on this Mac)
//                                                or "elevenlabs" (default; ELEVENLABS_* in .env)
//        node audio.js mix silent.mp4 out.mp4 -> adds the voice + music.mp3 (if present, ~15% volume) to the video
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SCENES = path.join(ROOT, 'scenes.json');
const VOICE_DIR = path.join(ROOT, 'output', 'voice');
const MUSIC = path.join(ROOT, 'music.mp3');
const LEAD = 0.3, TAIL = 0.5;   // silence before / after each line inside its scene
const MUSIC_VOLUME = 0.15;
// shortest a scene may get, so its animations don't rush too much: 0.75 x the template's design length
const minLength = (S, id) => 0.75 * (require(`./template/${S.template || 'discount'}.js`).scenes[id] || 4);

function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const seconds = file => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString();

async function elevenlabs(text, voiceId, model, out) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: model }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

// Kokoro runs on this Mac (model is downloaded once, then cached)
let kokoroModel;
async function kokoro(text, name, out) {
  if (!kokoroModel) {
    const { KokoroTTS } = await import('kokoro-js');
    kokoroModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
  }
  await (await kokoroModel.generate(text, { voice: name })).save(out);
}

async function voice() {
  loadEnv();
  const S = JSON.parse(fs.readFileSync(SCENES, 'utf8'));
  const v = (S.brand && S.brand.voice) || {};
  const engine = v.engine || 'elevenlabs';
  const name = engine === 'kokoro' ? v.name || 'am_michael' : v.name || process.env.ELEVENLABS_VOICE_ID;
  const model = engine === 'kokoro' ? 'q8' : v.model || process.env.ELEVENLABS_MODEL || 'eleven_v3';
  if (engine === 'elevenlabs' && !(process.env.ELEVENLABS_API_KEY && name)) throw new Error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env');
  console.log(`  voice: ${engine} ${name} (${model})`);
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  for (const s of S.scenes) {
    if (!s.voice || !s.voice.trim()) { delete s.audio; continue; }
    // same text + voice + model = reuse the old file (saves ElevenLabs credits / time)
    const key = engine === 'kokoro' ? [s.voice, 'kokoro', name, model] : [s.voice, name, model];
    const hash = crypto.createHash('sha1').update(key.join('|')).digest('hex').slice(0, 10);
    const file = path.join(VOICE_DIR, `${s.id}-${hash}.${engine === 'kokoro' ? 'wav' : 'mp3'}`);
    if (fs.existsSync(file)) console.log(`  ${s.id}: reusing saved voice`);
    else if (engine === 'kokoro') { console.log(`  ${s.id}: Kokoro...`); await kokoro(s.voice, name, file); }
    else { console.log(`  ${s.id}: ElevenLabs...`); await elevenlabs(s.voice, name, model, file); }
    const len = seconds(file);
    s.audio = path.relative(ROOT, file);
    s.duration = +Math.max(LEAD + len + TAIL, minLength(S, s.id)).toFixed(2);
    console.log(`  ${s.id}: voice ${len.toFixed(1)} s -> scene ${s.duration} s`);
  }
  const total = S.scenes.reduce((a, s) => a + s.duration, 0);
  fs.writeFileSync(SCENES, JSON.stringify(S, null, 2) + '\n');
  console.log(`Total ${total.toFixed(1)} s` + (total > 45 ? '  (over 45 s: the voice lines are long)' : ''));
}

function mix(silent, out) {
  const S = JSON.parse(fs.readFileSync(SCENES, 'utf8'));
  const total = S.scenes.reduce((a, s) => a + s.duration, 0);
  const args = ['-y', '-v', 'error', '-i', silent], parts = [], labels = [];
  let start = 0, n = 1;
  for (const s of S.scenes) {
    if (s.audio && fs.existsSync(path.join(ROOT, s.audio))) {
      args.push('-i', path.join(ROOT, s.audio));
      const ms = Math.round((start + LEAD) * 1000);
      parts.push(`[${n}:a]adelay=${ms}:all=1[v${n}]`); labels.push(`[v${n}]`); n++;
    }
    start += s.duration;
  }
  if (fs.existsSync(MUSIC)) {
    args.push('-stream_loop', '-1', '-t', total.toFixed(3), '-i', MUSIC);
    const fade = Math.max(0, total - 1.5).toFixed(2);
    parts.push(`[${n}:a]volume=${MUSIC_VOLUME},afade=t=out:st=${fade}:d=1.5[m]`); labels.push('[m]');
  }
  if (!labels.length) { console.log('No voice or music: keeping the silent video.'); fs.copyFileSync(silent, out); return; }
  parts.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,apad[a]`);
  args.push('-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[a]', '-t', total.toFixed(3),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`Added ${n - 1} voice clips${fs.existsSync(MUSIC) ? ' + music' : ' (no music.mp3 found)'} -> ${path.relative(ROOT, out)}`);
}

const [cmd, a, b] = process.argv.slice(2);
(async () => {
  if (cmd === 'voice') await voice();
  else if (cmd === 'mix') mix(a, b);
  else console.log('usage: node audio.js voice | node audio.js mix silent.mp4 out.mp4');
})().catch(e => { console.error(e.message); process.exit(1); });
