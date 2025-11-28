// ========================
// CONFIG: GITHUB SYNC
// ========================

// FILL THESE with your actual GitHub details:
const GITHUB_OWNER = "YOUR_GITHUB_USERNAME";      // e.g. "gunjanjangid"
const GITHUB_REPO = "YOUR_REPO_NAME";             // e.g. "kids-word-app"
const GITHUB_FILE_PATH = "data/words.json";       // any path inside repo
const GITHUB_BRANCH = "main";                     // or "master"

// ⚠️ Personal Access Token (PAT) with repo contents:write permission.
// For safety, keep this repo PRIVATE or use a backend instead of putting token in JS.
const GITHUB_TOKEN = "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"; 

// If token is empty, GitHub sync is disabled.
const GITHUB_ENABLED = Boolean(
  GITHUB_OWNER && GITHUB_REPO && GITHUB_FILE_PATH && GITHUB_BRANCH && GITHUB_TOKEN
);

// ========================
// SPEECH (Hindi / English)
// ========================

let currentLanguage = "EN"; // "EN" or "HI"
let voicesLoaded = false;

function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.getVoices();
  voicesLoaded = true;
}

function getVoiceForLanguage() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const prefix = currentLanguage === "HI" ? "hi" : "en";
  let v = voices.find(
    voice => voice.lang && voice.lang.toLowerCase().startsWith(prefix)
  );
  if (!v) {
    // fallback to first available
    v = voices[0] || null;
  }
  return v;
}

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  if (!voicesLoaded) loadVoices();

  const utter = new SpeechSynthesisUtterance(text);
  const voice = getVoiceForLanguage();
  if (voice) utter.voice = voice;

  // slightly slower for kids
  utter.rate = 0.9;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function speakLetter(letter) {
  speakText(letter);
}

// ========================
// LOCAL STORAGE / STATE
// ========================

const STORAGE_KEY = "kid_custom_words_v3";

let words = []; // {id, word, category, imageData}
let currentWord = null;
let currentSlots = [];
let categoryFilterValue = "ALL";

let githubSha = null;

// ========================
// DOM REFERENCES
// ========================

const wordImage = document.getElementById("wordImage");
const noWordsMessage = document.getElementById("noWordsMessage");
const answerSlotsEl = document.getElementById("answerSlots");
const hintLetterEl = document.getElementById("hintLetter");
const messageEl = document.getElementById("message");
const keyboardEl = document.getElementById("keyboard");

const settingsButton = document.getElementById("settingsButton");
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");

const categoryInput = document.getElementById("categoryInput");
const wordInput = document.getElementById("wordInput");
const imageInput = document.getElementById("imageInput");
const imageURL = document.getElementById("imageURL");
const addWordButton = document.getElementById("addWordButton");

const wordListEl = document.getElementById("wordList");
const categoryFilter = document.getElementById("categoryFilter");

const voiceLangSelect = document.getElementById("voiceLang");
const syncStatusEl = document.getElementById("syncStatus");
const syncNowButton = document.getElementById("syncNowButton");

// ========================
// HELPERS
// ========================

function updateSyncStatus(text) {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = `GitHub sync: ${text}`;
}

function safeBtoa(str) {
  // handle unicode safely
  return btoa(unescape(encodeURIComponent(str)));
}

function safeAtob(str) {
  return decodeURIComponent(escape(atob(str)));
}

// ========================
// LOAD / SAVE LOCAL
// ========================

function loadWordsLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    words = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error loading words from localStorage:", e);
    words = [];
  }
}

function saveWordsLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch (e) {
    console.error("Error saving words to localStorage:", e);
  }
}

// ========================
// GITHUB SYNC
// ========================

async function loadWordsFromGitHub() {
  if (!GITHUB_ENABLED) {
    updateSyncStatus("off");
    return;
  }
  updateSyncStatus("loading...");

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (!res.ok) {
      updateSyncStatus("error loading");
      return;
    }

    const data = await res.json();
    githubSha = data.sha || null;
    const jsonStr = safeAtob(data.content.replace(/\n/g, ""));
    const remoteWords = JSON.parse(jsonStr);

    if (Array.isArray(remoteWords) && remoteWords.length > 0) {
      words = remoteWords;
      saveWordsLocal();
      updateSyncStatus("loaded");
    } else {
      updateSyncStatus("empty file");
    }
  } catch (e) {
    console.error("GitHub load error:", e);
    updateSyncStatus("error");
  }
}

async function syncWordsToGitHub() {
  if (!GITHUB_ENABLED) return;

  updateSyncStatus("syncing...");

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;

  try {
    // ensure sha if not known
    if (!githubSha) {
      const res0 = await fetch(
        `${apiUrl}?ref=${GITHUB_BRANCH}`,
        {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json"
          }
        }
      );
      if (res0.ok) {
        const d0 = await res0.json();
        githubSha = d0.sha || null;
      }
    }

    const jsonStr = JSON.stringify(words);
    const base64Content = safeBtoa(jsonStr);

    const body = {
      message: "Update words from kid app",
      content: base64Content,
      branch: GITHUB_BRANCH
    };
    if (githubSha) body.sha = githubSha;

    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error("GitHub sync failed:", await res.text());
      updateSyncStatus("sync error");
      return;
    }

    const data = await res.json();
    githubSha = data.content && data.content.sha ? data.content.sha : githubSha;
    updateSyncStatus("synced");
  } catch (e) {
    console.error("GitHub sync error:", e);
    updateSyncStatus("sync error");
  }
}

// ========================
// KEYBOARD
// ========================

function createKeyboard() {
  keyboardEl.innerHTML = "";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  letters.forEach(letter => {
    const btn = document.createElement("button");
    btn.className = "key";
    btn.textContent = letter;
    btn.addEventListener("click", () => handleKey(letter));
    keyboardEl.appendChild(btn);
  });
}

// ========================
// GAME LOGIC
// ========================

function getPlayable() {
  if (categoryFilterValue === "ALL") return words;
  return words.filter(
    w => w.category.toUpperCase() === categoryFilterValue.toUpperCase()
  );
}

function pickRandomWord() {
  const playable = getPlayable();
  if (playable.length === 0) {
    currentWord = null;
    return null;
  }
  const index = Math.floor(Math.random() * playable.length);
  currentWord = playable[index];
  return currentWord;
}

function setupWordDisplay() {
  if (!currentWord) {
    wordImage.style.display = "none";
    noWordsMessage.style.display = "block";
    answerSlotsEl.innerHTML = "";
    hintLetterEl.textContent = "";
    messageEl.textContent = "";
    return;
  }

  wordImage.src = currentWord.imageData;
  wordImage.style.display = "block";
  noWordsMessage.style.display = "none";

  const word = currentWord.word;
  currentSlots = Array(word.length).fill("");

  answerSlotsEl.innerHTML = "";
  for (let i = 0; i < word.length; i++) {
    const s = document.createElement("span");
    s.className = "answer-slot";
    s.textContent = "";
    answerSlotsEl.appendChild(s);
  }

  hintLetterEl.textContent = word[0] || "";
  messageEl.textContent = "";
}

function handleKey(letter) {
  if (!currentWord) return;

  speakLetter(letter);

  const emptyIndex = currentSlots.findIndex(v => v === "");
  if (emptyIndex === -1) return;

  currentSlots[emptyIndex] = letter;
  answerSlotsEl.children[emptyIndex].textContent = letter;

  const filled = currentSlots.every(v => v !== "");
  if (!filled) return;

  const guess = currentSlots.join("");
  const correct = currentWord.word;

  if (guess === correct) {
    messageEl.textContent = "✅ Correct!";
    speakText(correct);
    setTimeout(() => {
      pickRandomWord();
      setupWordDisplay();
    }, 800);
  } else {
    messageEl.textContent = "❌ Try again!";
    setTimeout(() => {
      currentSlots = currentSlots.map(() => "");
      Array.from(answerSlotsEl.children).forEach(s => (s.textContent = ""));
      messageEl.textContent = "";
    }, 700);
  }
}

// ========================
// SETTINGS PANEL
// ========================

function openSettings() {
  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
}

function closeSettingsPanel() {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
}

function refreshList() {
  wordListEl.innerHTML = "";
  if (words.length === 0) {
    wordListEl.textContent = "No words added yet.";
    return;
  }

  words.forEach(w => {
    const row = document.createElement("div");
    row.className = "word-item";

    const label = document.createElement("span");
    label.textContent = `${w.word} (${w.category})`;

    const del = document.createElement("button");
    del.textContent = "🗑";
    del.style.border = "none";
    del.style.background = "transparent";
    del.style.cursor = "pointer";
    del.addEventListener("click", () => deleteWord(w.id));

    row.appendChild(label);
    row.appendChild(del);
    wordListEl.appendChild(row);
  });
}

function refreshCategoryFilter() {
  const cats = [...new Set(words.map(w => w.category))].sort();

  categoryFilter.innerHTML = "";
  const all = document.createElement("option");
  all.value = "ALL";
  all.textContent = "ALL";
  categoryFilter.appendChild(all);

  cats.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categoryFilter.appendChild(opt);
  });

  categoryFilter.value = "ALL";
  categoryFilterValue = "ALL";
}

function deleteWord(id) {
  words = words.filter(w => w.id !== id);
  saveWordsLocal();
  refreshList();
  refreshCategoryFilter();
  pickRandomWord();
  setupWordDisplay();
  syncWordsToGitHub();
}

// ========================
// ADD WORD (FILE + URL)
// ========================

function handleAddWord() {
  const category = (categoryInput.value || "GENERAL").trim().toUpperCase();
  const word = (wordInput.value || "").trim().toUpperCase();
  const file = imageInput.files[0];
  const url = imageURL.value.trim();

  if (!word) {
    alert("Please enter a WORD.");
    return;
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = e => saveNewWord(word, category, e.target.result);
    reader.readAsDataURL(file);
    return;
  }

  if (url !== "") {
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const fr = new FileReader();
        fr.onload = e => saveNewWord(word, category, e.target.result);
        fr.readAsDataURL(blob);
      })
      .catch(() => alert("Invalid image URL"));
    return;
  }

  alert("Please upload an image file OR paste an image URL.");
}

function saveNewWord(word, category, base64) {
  const newWord = {
    id: Date.now(),
    word,
    category,
    imageData: base64
  };

  words.push(newWord);
  saveWordsLocal();
  refreshList();
  refreshCategoryFilter();

  wordInput.value = "";
  imageInput.value = "";
  imageURL.value = "";

  if (!currentWord) {
    pickRandomWord();
    setupWordDisplay();
  }

  syncWordsToGitHub();
}

// ========================
// INIT
// ========================

window.addEventListener("load", () => {
  loadVoices();
  if (typeof speechSynthesis !== "undefined") {
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  loadWordsLocal();

  if (GITHUB_ENABLED) {
    updateSyncStatus("starting...");
    // merge GitHub words on top of local
    loadWordsFromGitHub().then(() => {
      refreshList();
      refreshCategoryFilter();
      createKeyboard();
      pickRandomWord();
      setupWordDisplay();
    });
  } else {
    updateSyncStatus("off");
    refreshList();
    refreshCategoryFilter();
    createKeyboard();
    pickRandomWord();
    setupWordDisplay();
  }
});

// Events
settingsButton.addEventListener("click", openSettings);
closeSettings.addEventListener("click", closeSettingsPanel);

settingsModal
  .querySelector(".modal-backdrop")
  .addEventListener("click", closeSettingsPanel);

addWordButton.addEventListener("click", handleAddWord);

categoryFilter.addEventListener("change", () => {
  categoryFilterValue = categoryFilter.value;
  pickRandomWord();
  setupWordDisplay();
});

voiceLangSelect.addEventListener("change", () => {
  currentLanguage = voiceLangSelect.value;
});

syncNowButton.addEventListener("click", () => {
  syncWordsToGitHub();
});
