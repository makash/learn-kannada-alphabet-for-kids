import { letters } from './data/letters.js';

const letterEl = document.querySelector('#kannadaChar');
const equivEl = document.querySelector('#equivalent');
const positionEl = document.querySelector('#position');
const equivLabel = document.querySelector('#equivalentLabel');
const wordList = document.querySelector('#wordList');
const playKannadaBtn = document.querySelector('#playKannada');
const mainWordBtn = document.querySelector('#mainWord');
const mainTranslit = document.querySelector('#mainTranslit');
const mainMeaning = document.querySelector('#mainMeaning');
const prevBtn = document.querySelector('#prevBtn');
const nextBtn = document.querySelector('#nextBtn');
const toggleEnglish = document.querySelector('#toggleEnglish');
const toggleHindi = document.querySelector('#toggleHindi');
const quickNav = document.querySelector('#quickNav');
const toggleGoogle = document.querySelector('#toggleGoogle');
const toggleSarvam = document.querySelector('#toggleSarvam');

const state = {
  index: 0,
  lang: localStorage.getItem('uiLang') || 'en',
  failedAudio: new Set(),
};

function getProvider() {
  return localStorage.getItem('ttsProvider') || 'google';
}

function buildQuickNav() {
  quickNav.innerHTML = '';
  letters.forEach((row, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-nav-button';
    btn.innerHTML = `<span class="nav-letter">${row.kannada}</span><span class="nav-word"></span>`;
    btn.setAttribute('aria-label', `Go to ${row.kannada}`);
    btn.dataset.index = String(index);
    btn.addEventListener('click', () => {
      state.index = index;
      render();
    });
    quickNav.appendChild(btn);
  });
}

const localeMap = {
  en: 'en-US',
  hi: 'hi-IN',
};

function normalizeId(id) {
  return encodeURIComponent(id)
    .toLowerCase()
    .replace(/%/g, '-')
    .replace(/[^a-z0-9-]/g, '-');
}

function voicesFor(locale) {
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find((v) => v.lang === locale);
  if (exact) return exact;
  const loose = voices.find((v) => v.lang.startsWith(locale.split('-')[0]));
  return loose || voices[0];
}

function speakWithWebSpeech(text, locale) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve(false);
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = locale;
    utter.voice = voicesFor(locale);
    utter.rate = 0.9;
    utter.pitch = 1;
    utter.onend = () => resolve(true);
    utter.onerror = () => resolve(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

function audioPath(locale, id, suffix) {
  return `audio/${getProvider()}/${locale}/${normalizeId(id)}_${suffix}.mp3`;
}

function speakAudioOrFallback(text, locale, id, suffix) {
  const path = audioPath(locale, id, suffix);
  if (state.failedAudio.has(path)) {
    return speakWithWebSpeech(text, locale).then(() => true);
  }

  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = path;
    audio.preload = 'auto';

    const fail = () => {
      state.failedAudio.add(path);
      audio.removeEventListener('canplaythrough', success);
      audio.removeEventListener('error', fail);
      speakWithWebSpeech(text, locale).then(() => resolve(true));
    };
    const success = () => {
      audio.removeEventListener('canplaythrough', success);
      audio.removeEventListener('error', fail);
      audio.play().catch(() => speakWithWebSpeech(text, locale).then(() => resolve(true)));
      audio.onended = () => resolve(true);
      audio.onerror = () => speakWithWebSpeech(text, locale).then(() => resolve(true));
    };
    audio.addEventListener('canplaythrough', success);
    audio.addEventListener('error', fail);
    // start load
    audio.load();
  });
}

function renderWords(letter) {
  const langWords = letter.words[state.lang] || [];
  wordList.innerHTML = '';

  for (const item of langWords) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<span class="word">${item.text}</span><span class="meaning">${item.meaning}</span>`;
    btn.addEventListener('click', () => {
      const phrase = item.text;
      const id = `${letter.id}|${state.lang}|${item.text}`;
      const locale = localeMap[state.lang] || 'en-US';
      speakAudioOrFallback(phrase, locale, id, 'word');
    });
    wordList.appendChild(btn);
  }
}

function render() {
  const letter = letters[state.index];
  if (!letter) {
    return;
  }

  const primaryWord = letter.kannadaWord || '';
  const primaryTranslit = letter.kannadaTransliteration || '';
  const primaryMeaning = letter.kannadaMeaning || '';
  letterEl.textContent = letter.kannada;
  const eq = state.lang === 'en' ? letter.english : letter.hindi;
  equivEl.textContent = eq;
  equivLabel.textContent = `Equivalent (${state.lang === 'en' ? 'English' : 'Hindi'})`;
  positionEl.textContent = `${state.index + 1} / ${letters.length}`;
  mainWordBtn.textContent = primaryWord || '—';
  mainWordBtn.disabled = !primaryWord;
  mainTranslit.textContent = primaryTranslit || '—';
  mainMeaning.textContent = primaryMeaning || '—';

  toggleEnglish.classList.toggle('active', state.lang === 'en');
  toggleHindi.classList.toggle('active', state.lang === 'hi');
  toggleEnglish.setAttribute('aria-selected', state.lang === 'en' ? 'true' : 'false');
  toggleHindi.setAttribute('aria-selected', state.lang === 'hi' ? 'true' : 'false');
  const provider = getProvider();
  toggleGoogle.classList.toggle('active', provider === 'google');
  toggleSarvam.classList.toggle('active', provider === 'sarvam');
  toggleGoogle.setAttribute('aria-selected', provider === 'google' ? 'true' : 'false');
  toggleSarvam.setAttribute('aria-selected', provider === 'sarvam' ? 'true' : 'false');
  const providerLabel = document.querySelector('#providerLabel');
  if (providerLabel) providerLabel.textContent = provider === 'sarvam' ? 'Sarvam TTS' : 'Google TTS';

  renderWords(letter);
  [...quickNav.children].forEach((button, idx) => {
    const isActive = idx === state.index;
    button.classList.toggle('active', isActive);
    const label = letters[idx]?.kannadaWord || '';
    const wordEl = button.querySelector('.nav-word');
    if (wordEl) wordEl.textContent = label;
  });
}

function next() {
  state.index = (state.index + 1) % letters.length;
  render();
}

function prev() {
  state.index = (state.index - 1 + letters.length) % letters.length;
  render();
}

playKannadaBtn.addEventListener('click', () => {
  const letter = letters[state.index];
  const phrase = letter.kannada;
  speakAudioOrFallback(phrase, 'kn-IN', normalizeId(letter.id), 'kannada');
});

mainWordBtn.addEventListener('click', () => {
  const letter = letters[state.index];
  const text = letter.kannadaWord;
  if (!text) return;
  const id = `${letter.id}|kn|${text}`;
  speakAudioOrFallback(text, 'kn-IN', id, 'word');
});

toggleEnglish.addEventListener('click', () => {
  state.lang = 'en';
  localStorage.setItem('uiLang', 'en');
  render();
});

toggleHindi.addEventListener('click', () => {
  state.lang = 'hi';
  localStorage.setItem('uiLang', 'hi');
  render();
});

toggleGoogle.addEventListener('click', () => {
  localStorage.setItem('ttsProvider', 'google');
  render();
});

toggleSarvam.addEventListener('click', () => {
  localStorage.setItem('ttsProvider', 'sarvam');
  render();
});

prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') prev();
  if (event.key === 'ArrowRight') next();
});

window.speechSynthesis.onvoiceschanged = () => {
  render();
};

buildQuickNav();
render();
