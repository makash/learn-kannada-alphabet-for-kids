import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { letters } from '../data/letters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.GOOGLE_TTS_API_KEY;
const OUTPUT_DIR = path.resolve(ROOT, 'audio', 'google');
const PROJECT_ROOT = ROOT;
const ONLY_KANNADA_WORDS = process.env.ONLY_KANNADA_WORDS === '1';

if (!API_KEY) {
  console.error('Missing GOOGLE_TTS_API_KEY. Set it in environment and rerun.');
  process.exit(1);
}

const voiceProfiles = {
  'en-US': ['en-US-Standard-D', 'en-US-Wavenet-D', 'en-US-Neural2-C'],
  'hi-IN': ['hi-IN-Standard-A', 'hi-IN-Wavenet-A'],
  'kn-IN': ['kn-IN-Standard-A', 'kn-IN-Wavenet-A'],
};

async function requestTts(text, languageCode, voiceName) {
  const endpoint = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;
  const payload = {
    input: { text },
    voice: {
      languageCode,
      ssmlGender: 'FEMALE',
    },
    audioConfig: { audioEncoding: 'MP3' },
  };

  if (voiceName) {
    payload.voice.name = voiceName;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TTS API error ${response.status}: ${body}`);
  }

  const json = await response.json();
  return Buffer.from(json.audioContent, 'base64');
}

async function tts(text, languageCode) {
  const candidates = voiceProfiles[languageCode] || [];

  for (const voiceName of candidates) {
    try {
      return await requestTts(text, languageCode, voiceName);
    } catch (err) {
      const body = err?.message || '';
      const missingVoice = body.includes('does not exist') || body.includes('INVALID_ARGUMENT');
      if (!missingVoice) throw err;
    }
  }

  // final fallback: let Google select default by language/gender
  return requestTts(text, languageCode);
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
  for (const row of letters) {
    const letterPath = path.join(knDir, safeFile(row.id, 'kannada'));
    if (!ONLY_KANNADA_WORDS && !(await exists(letterPath))) {
      const letterAudio = await tts(row.kannada, 'kn-IN');
      await writeFile(letterPath, letterAudio);
    }
    if (row.kannadaWord) {
      const wordPath = path.join(knDir, safeFile(`${row.id}|kn|${row.kannadaWord}`, 'word'));
      if (!(await exists(wordPath))) {
        const wordAudio = await tts(row.kannadaWord, 'kn-IN');
        await writeFile(wordPath, wordAudio);
      }
    }
  }

  for (const locale of ['en-US', 'hi-IN']) {
    const dir = await ensureDir(locale);
    const languageKey = locale.startsWith('en') ? 'en' : 'hi';
    for (const row of letters) {
      const wordList = row.words[languageKey];
      for (const word of wordList) {
        const phraseAudio = await tts(word.text, locale);
        const wordPath = path.join(dir, safeFile(`${row.id}|${languageKey}|${word.text}`, 'word'));
        await writeFile(wordPath, phraseAudio);
      }
    }
  }
  await fs.writeFile(
    path.join(PROJECT_ROOT, 'audio-manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider: 'Google Cloud Text-to-Speech',
        locales: ['en-US', 'hi-IN', 'kn-IN'],
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log('Generated Google TTS audio files');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
