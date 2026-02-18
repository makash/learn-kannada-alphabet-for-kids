import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { letters } from '../data/letters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.SARVAM_API_KEY;
const OUTPUT_DIR = path.resolve(ROOT, 'audio', 'sarvam');
const PROJECT_ROOT = ROOT;
const ENDPOINT = 'https://api.sarvam.ai/text-to-speech';

if (!API_KEY) {
  console.error('Missing SARVAM_API_KEY. Set it in environment and rerun.');
  process.exit(1);
}

const MODEL = process.env.SARVAM_MODEL || 'bulbul:v3';
const SPEAKER = process.env.SARVAM_SPEAKER || 'meera';
const PACE = process.env.SARVAM_PACE ? Number(process.env.SARVAM_PACE) : undefined;
const TEMPERATURE = process.env.SARVAM_TEMPERATURE ? Number(process.env.SARVAM_TEMPERATURE) : undefined;
const ONLY_KANNADA = process.env.ONLY_KANNADA === '1';
const ONLY_ENGLISH = process.env.ONLY_ENGLISH === '1';
const ONLY_HINDI = process.env.ONLY_HINDI === '1';
const ONLY_KANNADA_WORDS = process.env.ONLY_KANNADA_WORDS === '1';
const THROTTLE_MS = process.env.SARVAM_THROTTLE_MS
  ? Number(process.env.SARVAM_THROTTLE_MS)
  : 3000;

async function tts(text, targetLanguageCode) {
  const payload = {
    text,
    target_language_code: targetLanguageCode,
    model: MODEL,
    speaker: SPEAKER,
    output_audio_codec: 'mp3',
  };

  if (Number.isFinite(PACE)) payload.pace = PACE;
  if (Number.isFinite(TEMPERATURE)) payload.temperature = TEMPERATURE;

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Sarvam TTS error ${response.status}: ${JSON.stringify(json)}`);
  }

  const audioBase64 = json?.audios?.[0];
  if (!audioBase64) {
    throw new Error('Sarvam TTS error: no audio returned');
  }

  return Buffer.from(audioBase64, 'base64');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ttsWithRetry(text, targetLanguageCode, attempts = 6) {
  let delay = 800;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const audio = await tts(text, targetLanguageCode);
      if (Number.isFinite(THROTTLE_MS) && THROTTLE_MS > 0) {
        await sleep(THROTTLE_MS);
      }
      return audio;
    } catch (err) {
      const msg = String(err?.message || '');
      const isRateLimit = msg.includes('rate_limit_exceeded_error') || msg.includes('429');
      const isServerError = msg.includes('500') || msg.includes('internal_server_error');
      if ((!isRateLimit && !isServerError) || i === attempts - 1) throw err;
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error('Sarvam TTS error: exceeded retries');
}

function safeFile(base, suffix) {
  const clean = encodeURIComponent(base.toString())
    .toLowerCase()
    .replace(/%/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${clean}_${suffix}.mp3`;
}

async function ensureDir(locale) {
  const dir = path.join(OUTPUT_DIR, locale);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writeFile(filePath, buffer) {
  await fs.writeFile(filePath, buffer);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const knDir = await ensureDir('kn-IN');
  if (!ONLY_ENGLISH && !ONLY_HINDI) {
    for (const row of letters) {
      const letterPath = path.join(knDir, safeFile(row.id, 'kannada'));
      if (!ONLY_KANNADA_WORDS && !(await exists(letterPath))) {
        const letterAudio = await ttsWithRetry(row.kannada, 'kn-IN');
        await writeFile(letterPath, letterAudio);
      }
      if (row.kannadaWord) {
        const wordPath = path.join(knDir, safeFile(`${row.id}|kn|${row.kannadaWord}`, 'word'));
        if (await exists(wordPath)) continue;
        const wordAudio = await ttsWithRetry(row.kannadaWord, 'kn-IN');
        await writeFile(wordPath, wordAudio);
      }
    }
  }

  if (ONLY_KANNADA || ONLY_KANNADA_WORDS) {
    await fs.writeFile(
      path.join(PROJECT_ROOT, 'audio-manifest.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          provider: 'Sarvam AI Text-to-Speech',
          locales: ['kn-IN'],
          model: MODEL,
          speaker: SPEAKER,
        },
        null,
        2
      ),
      'utf-8'
    );
    console.log('Generated Sarvam TTS Kannada audio files');
    return;
  }

  const locales = [];
  if (!ONLY_HINDI) locales.push('en-IN');
  if (!ONLY_ENGLISH) locales.push('hi-IN');

  for (const locale of locales) {
    const dir = await ensureDir(locale === 'en-IN' ? 'en-US' : 'hi-IN');
    const languageKey = locale.startsWith('en') ? 'en' : 'hi';
    for (const row of letters) {
      const wordList = row.words[languageKey];
      for (const word of wordList) {
        const wordPath = path.join(dir, safeFile(`${row.id}|${languageKey}|${word.text}`, 'word'));
        if (await exists(wordPath)) continue;
        const phraseAudio = await ttsWithRetry(word.text, locale);
        await writeFile(wordPath, phraseAudio);
      }
    }
  }

  await fs.writeFile(
    path.join(PROJECT_ROOT, 'audio-manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider: 'Sarvam AI Text-to-Speech',
        locales: ['en-IN', 'hi-IN', 'kn-IN'],
        model: MODEL,
        speaker: SPEAKER,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log('Generated Sarvam TTS audio files');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
