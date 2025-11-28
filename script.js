// ======================
// SPEECH FUNCTIONS
// ======================

function speakText(text) {
  if (!("speechSynthesis" in window)) return;

  const utter = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();
  const enVoice =
    voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en")) || null;
  if (enVoice) utter.voice = enVoice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function speakLetter(letter) {
  speakText(letter);
}



// ======================
// LOCAL STORAGE / STATE
// ======================

const STORAGE_KEY = "kid_custom_words_v2";

let words = []; // {id, word, category, imageData}
let currentWord = null;
let currentSlots = [];
let categoryFilterValue = "ALL";



// ======================
// DOM REFERENCES
// ======================

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



// ======================
// LOAD / SAVE FUNCTIONS
// ======================

function loadWords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    words = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error loading words:", e);
    words = [];
  }
}

function saveWords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch (e) {
    console.error("Error saving words:", e);
  }
}



// ======================
// KEYBOARD BUILD
// ======================

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



// ======================
// GAME LOGIC
// ======================

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

  const finished = currentSlots.every(v => v !== "");
  if (!finished) return;

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



// ======================
// SETTINGS PANEL FUNCTIONS
// ======================

function openSettings() {
  settingsModal.classList.remove("hidden");
}

function closeSettingsPanel() {
  settingsModal.classList.add("hidden");
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

    row.innerHTML = `
      <span>${w.word} (${w.category})</span>
    `;

    const del = document.createElement("button");
    del.textContent = "🗑";
    del.style.border = "none";
    del.style.background = "transparent";
    del.style.cursor = "pointer";

    del.onclick = () => deleteWord(w.id);

    row.appendChild(del);
    wordListEl.appendChild(row);
  });
}

function refreshCategoryFilter() {
  const categories = [...new Set(words.map(w => w.category))].sort();

  categoryFilter.innerHTML = "";
  const all = document.createElement("option");
  all.value = "ALL";
  all.textContent = "ALL";
  categoryFilter.appendChild(all);

  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categoryFilter.appendChild(opt);
  });

  categoryFilter.value = "ALL";
}

function deleteWord(id) {
  words = words.filter(w => w.id !== id);
  saveWords();
  refreshList();
  refreshCategoryFilter();
  pickRandomWord();
  setupWordDisplay();
}



// ======================
// ADD WORD: FILE + URL
// ======================

function handleAddWord() {
  const category = (categoryInput.value || "GENERAL").trim().toUpperCase();
  const word = (wordInput.value || "").trim().toUpperCase();
  const file = imageInput.files[0];
  const url = imageURL.value.trim();

  if (!word) {
    alert("Please enter a word.");
    return;
  }

  // FILE upload
  if (file) {
    const reader = new FileReader();
    reader.onload = e => saveNewWord(word, category, e.target.result);
    reader.readAsDataURL(file);
    return;
  }

  // URL upload
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

  alert("Please upload a file or paste an image URL.");
}

function saveNewWord(word, category, base64) {
  const newWord = {
    id: Date.now(),
    word,
    category,
    imageData: base64
  };

  words.push(newWord);
  saveWords();
  refreshList();
  refreshCategoryFilter();

  wordInput.value = "";
  imageInput.value = "";
  imageURL.value = "";

  if (!currentWord) {
    pickRandomWord();
    setupWordDisplay();
  }
}



// ======================
// INIT
// ======================

window.addEventListener("load", () => {
  window.speechSynthesis.getVoices(); // iOS fix
});

settingsButton.addEventListener("click", openSettings);
closeSettings.addEventListener("click", closeSettingsPanel);

settingsModal
  .querySelector(".modal-backdrop")
  ?.addEventListener("click", closeSettingsPanel);

addWordButton.addEventListener("click", handleAddWord);

categoryFilter.addEventListener("change", () => {
  categoryFilterValue = categoryFilter.value;
  pickRandomWord();
  setupWordDisplay();
});

loadWords();
createKeyboard();
refreshList();
refreshCategoryFilter();
pickRandomWord();
setupWordDisplay();
