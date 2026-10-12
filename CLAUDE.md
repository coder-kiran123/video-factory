# Video Factory

Goal: type one idea -> get a finished TikTok video (MP4, 1080x1920, 30 fps) automatically.

## What already works
- Templates: `template/<name>.html` (the video) + `template/<name>.js` (scene ids with design lengths, JSON schema, story + rules for Claude, checks). `discount` = Nepali shop discount-code story; `loadstar` = English agent dashboard + pay link story (Loadstar brand look: navy, #2C47F5, gold star, Unbounded/Figtree/JetBrains Mono; blocks real game names and gambling words). scenes.json `template` picks it.
- Brands: `brands/<name>.json` (name, template, language, website, rules). `make.js --brand loadstar "idea"`; default brand sajilo. Examples sent to Claude: `examples/<template>.json`.
- `template/discount.html`: animated video (phone mockup, tap dot, zoom, Nepali text). Time is controlled by `window.render(t)` (t in seconds), so every frame is exact.
- `scenes.json`: all text, prices, offer code and scene durations (6 fixed scenes: hook, problem, setup, checkout, results, end). Headline lines: `*word*` = highlight, `~word~` = red highlight; `[words]` in the hook comment = marker. The template's animation times are a 40 s "design timeline"; a longer scene plays at normal speed and holds, a shorter one is sped up.
- `render.js`: reads scenes.json (optional 3rd arg = another file), injects it as `window.SCENES`, calls render(t) for every frame, pipes frames to FFmpeg. Video length = sum of scene durations.
- `make.js "idea"` (`npm run make -- "idea"`, add `--no-video` for script only): runs the `claude` CLI (signed in with the user's Pro plan, NOT the API key — ANTHROPIC_API_KEY is removed from its env) with `--json-schema`, gets offer + 6 scenes + a Nepali `voice` line per scene, checks it (one retry with the errors), writes scenes.json + output/voice.txt, then renders. `CLAUDE_MODEL` env var picks the model.
  - `npm run stills`  -> preview pictures in output/
  - `npm run video`   -> output/video_silent.mp4, then mixes audio into output/video.mp4
- `audio.js`: `voice` = one ElevenLabs MP3 per scene in output/voice/ (cached by text+voice+model hash), sets each scene `duration` = 0.3 s + voice + 0.5 s (min = 0.75 x design length) and `audio` path in scenes.json. `mix silent out` = voice clips at scene start + 0.3 s, plus `music.mp3` in the project root if present (15% volume, looped, 1.5 s fade out). Voice engine per brand: `brands/<name>.json` `voice: {engine, name}` (copied into scenes.json brand). `kokoro` = free local TTS via kokoro-js (model onnx-community/Kokoro-82M-v1.0-ONNX q8, downloaded once; writes .wav; Loadstar uses am_puck). Default `elevenlabs`: ELEVENLABS_VOICE_ID (Liam), ELEVENLABS_MODEL (default eleven_v3). The ElevenLabs key has no voices_read permission.

## Plan (build in this order, test after each step)
1. Move all text, prices, screen content and scene timings out of index.html into `scenes.json`; the template reads it.
2. `make.js "idea"`: call the Claude API to write scenes.json + a Nepali voice script (one line per scene).
3. Call the ElevenLabs API to make one MP3 per scene; read each MP3 length with ffprobe and set scene timings from it.
4. Render the video, then use FFmpeg to add the voice + background music (music at about 15% volume).
5. `brand.json` = memory: shop name, logo, colors, fonts, style rules. Always send it to Claude with the idea.
6. Optional: a small local web page with an idea box and a "Make video" button.

## Rules
- API keys go in `.env` (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY). Never commit `.env`.
- Videos are 9:16, 30-45 s. Nepali brands: Nepali text in the Mukta font. Loadstar: English (US agents), ends on loadstar.online.
- Don't use other companies' names, logos or app designs.
