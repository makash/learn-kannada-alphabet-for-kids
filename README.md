# Kannada-English-Hindi Alphabet PWA

This is a simple offline-ready PWA that teaches the Kannada alphabet to early learners (ages 6-8):

- Big Kannada character
- one-tap letter pronunciation
- one-tap English/Hindi word audio
- side-by-side Kannada + selected language panel
- low-end device-friendly caching and installable app behavior

## Run locally

Use any static server. For example:

```
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Offline strategy

- The app caches shell files with a service worker.
- Audio files are cached on first request.
- If an audio file is missing (or not generated yet), the app falls back to browser `SpeechSynthesis`.

## Generate Google TTS audio (recommended)

Install an API key and run:

```
GOOGLE_TTS_API_KEY=... npm run generate-audio
```

Generated files are written under:

- `audio/google/en-US/*.mp3`
- `audio/google/hi-IN/*.mp3`
- `audio/google/kn-IN/*.mp3`

Then the app will prefer local MP3 playback first (better consistency than browser voices).

## Current dataset scope

- Full Kannada alphabet dataset (vowels + consonants, 51 entries)
- 1–2 words per letter for each language

You can expand the list directly in `data/letters.js` and regenerate audio.

## Notes

- 11Labs can be added later as a different TTS generation path, but Google Cloud is the default for now because it is stable for Kannada and fits a low-cost budget at this app scale.

## Generate Sarvam TTS audio (alternative)

Set your Sarvam API key and run:

```
SARVAM_API_KEY=... npm run generate-audio:sarvam
```

Optional tuning:

- `SARVAM_MODEL` (default `bulbul:v3`)
- `SARVAM_SPEAKER` (default `meera`)
- `SARVAM_PACE` (e.g. `0.9`)
- `SARVAM_TEMPERATURE` (e.g. `0.1`)

Sarvam output replaces the audio files under:

- `audio/sarvam/en-US/*.mp3`
- `audio/sarvam/hi-IN/*.mp3`
- `audio/sarvam/kn-IN/*.mp3`

## Credits

- All code and implementation © 2026 [@makash](https://github.com/makash). All rights reserved.
- Sound generation uses the **Google Cloud Text-to-Speech API**.
