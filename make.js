// usage: node make.js [--brand loadstar] "idea" [--no-video]
// Asks Claude (through the `claude` command, signed in with your Pro plan) to write scenes.json
// + one voice line per scene for the brand's template, then makes the voice and renders output/video.mp4.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { obj } = require('./template/schema');

const ROOT = __dirname;
const readJson = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// scenes.json <-> the flat shape Claude answers with ({...extra, <scene id>: {...}})
const toFlat = (T, s) => ({ ...Object.fromEntries(Object.keys(T.extra).map(k => [k, s[k]])),
  ...Object.fromEntries(s.scenes.map(({ id, ...rest }) => [id, rest])) });
const toScenes = (T, template, brand, f) => ({ template, brand,
  ...Object.fromEntries(Object.keys(T.extra).map(k => [k, f[k]])),
  scenes: Object.keys(T.scenes).map(id => ({ id, ...f[id] })) });

function prompt(T, template, idea, brand) {
  const { template: _, rules = [], ...shown } = brand;
  const example = toFlat(T, readJson(`examples/${template}.json`));
  const today = new Date().toISOString().slice(0, 10);
  return `Write the script for a 30-45 second ${brand.language} TikTok video for this idea:
<idea>${idea}</idea>

The brand (use exactly this name; never mention any other company, brand, app or logo):
${JSON.stringify(shown)}
Brand rules:
${rules.map(r => '- ' + r).join('\n')}

The video template is fixed. It always tells this story in ${Object.keys(T.scenes).length} scenes, in this order:
${T.story(T.scenes)}

Rules:
${T.rules(today)}
- duration: seconds for the scene, close to the suggested time; the total must be 30-45.

Example of a good result for a different idea:
${JSON.stringify(example, null, 1)}`;
}

function check(T, f) {
  const e = [];
  for (const id of Object.keys(T.scenes)) {
    const s = f[id];
    if (!(s.duration >= 3)) e.push(`${id}.duration must be at least 3`);
    if (!s.voice.trim()) e.push(`${id}.voice is empty`);
    if (s.headline && (s.headline.length < 1 || s.headline.length > 2)) e.push(`${id}.headline must have 1-2 lines`);
    for (const l of s.headline || []) if (l.replace(/[*~]/g, '').length > T.headlineMax) e.push(`${id}.headline line too long: "${l}"`);
  }
  const total = Object.keys(T.scenes).reduce((a, id) => a + f[id].duration, 0);
  if (total < 30 || total > 45) e.push(`total duration is ${total} s, must be 30-45`);
  return e.concat(T.check(f));
}

function askClaude(text, schema, language) {
  const args = ['-p', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--setting-sources', '',
    '--system-prompt', `You write scripts for short ${language} TikTok ads. Reply only with the JSON the schema asks for.`,
    '--json-schema', JSON.stringify(schema)];
  if (process.env.CLAUDE_MODEL) args.push('--model', process.env.CLAUDE_MODEL);
  // no API key in the child env, so `claude` uses the Pro sign-in
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  return new Promise((resolve, reject) => {
    const c = spawn('claude', args, { cwd: os.tmpdir(), env });
    let out = '', err = '';
    c.stdout.on('data', d => out += d);
    c.stderr.on('data', d => err += d);
    c.on('error', e => reject(new Error(e.code === 'ENOENT' ? '`claude` command not found. Run: npm install -g @anthropic-ai/claude-code' : e.message)));
    c.on('close', code => {
      let j;
      try { j = JSON.parse(out); } catch { return reject(new Error(`claude failed (exit ${code}): ${err || out}`.trim())); }
      if (j.is_error || !j.structured_output) return reject(new Error('claude error: ' + (j.result || j.subtype)));
      resolve(j.structured_output);
    });
    c.stdin.end(text);
  });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    spawn(cmd, args, { cwd: ROOT, stdio: 'inherit' }).on('close', c => c ? reject(new Error(`${cmd} exited ${c}`)) : resolve());
  });
}

(async () => {
  const argv = process.argv.slice(2);
  const bi = argv.indexOf('--brand');
  const brandName = bi >= 0 ? argv[bi + 1] : 'sajilo';
  const idea = argv.filter((a, i) => !a.startsWith('--') && !(bi >= 0 && i === bi + 1)).join(' ').trim();
  if (!idea) { console.log('usage: node make.js [--brand loadstar] "your video idea" [--no-video]'); process.exit(1); }
  if (!fs.existsSync(path.join(ROOT, 'brands', brandName + '.json'))) throw new Error(`No brands/${brandName}.json`);
  const brand = readJson(`brands/${brandName}.json`);
  const template = brand.template;
  const T = require(`./template/${template}.js`);
  const schema = obj({ ...T.extra, ...T.schema });

  let text = prompt(T, template, idea, brand), flat, errors = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(attempt === 1 ? `Claude is writing the ${brand.name} script (${template} template)...` : 'Fixing: ' + errors.join('; '));
    flat = await askClaude(text, schema, brand.language);
    errors = check(T, flat);
    if (!errors.length) break;
    text = `${prompt(T, template, idea, brand)}\n\nYour previous answer:\n${JSON.stringify(flat)}\n\nFix these problems and answer again:\n- ${errors.join('\n- ')}`;
  }
  if (errors.length) { console.error('Script still has problems:\n- ' + errors.join('\n- ')); process.exit(1); }

  const { rules, template: _, ...brandShown } = brand;
  const scenes = toScenes(T, template, brandShown, flat);
  fs.writeFileSync(path.join(ROOT, 'scenes.json'), JSON.stringify(scenes, null, 2) + '\n');
  fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
  const voice = scenes.scenes.map(s => `[${s.id}] ${s.voice}`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'output', 'voice.txt'), voice + '\n');
  console.log(`\nWrote scenes.json and output/voice.txt\n\n${voice}\n`);

  if (argv.includes('--no-video')) return;
  console.log('Making the voice...');
  await run('node', ['audio.js', 'voice']);
  await run('node', ['render.js', 'video', 'output/video_silent.mp4']);
  await run('node', ['audio.js', 'mix', 'output/video_silent.mp4', 'output/video.mp4']);
  console.log('\nDone: output/video.mp4');
})().catch(e => { console.error(e.message); process.exit(1); });
