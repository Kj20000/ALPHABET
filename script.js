// ====== SPEECH ======
function speakText(text) {
  if (!("speechSynthesis" in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  // Use a child-friendly English voice if available
  const voices = window.speechSynthesis.getVoices();
  const enVoice =
    voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en")) || null;
  if (enVoice) utterance.voice = enVoice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function speakLetter(letter) {
  speakText(letter);
}

// ====== STATE ======
const STORAGE_KEY = "kid_custom_words_v1";

let words = []; // { id, word, category, imageData }
let currentWord = null;
let currentSlots = [];
let categoryFilterValue = "ALL";

// ====== DOM ELEMENTS ======
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
const addWordButton = document.getElementById("addWordButton");
const wordListEl = document.getElementById("wordList");
const categoryFilter = document.getElementById("categoryFilter");

// ====== LOAD / SAVE ======
function loadWordsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    words = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error loading words", e);
    words = [];
  }
}

function saveWordsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch (e) {
    console.error("Error saving words", e);
  }
}

// ====== SETUP KEYBOARD ======
function createKeyboard() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  keyboardEl.innerHTML = "";
  letters.forEach(letter => {
    const btn = document.createElement("button");
    btn.className = "key";
    btn.textContent = letter;
    btn.addEventListener("click", () => handleLetterClick(letter));
    keyboardEl.appendChild(btn);
  });
}

// ====== GAME LOGIC ======
function getPlayableWords() {
  if (categoryFilterValue === "ALL") return words;
  return words.filter(
    w => w.category.toUpperCase() === categoryFilterValue.toUpperCase()
  );
}

function pickRandomWord() {
  const playable = getPlayableWords();
  if (playable.length === 0) {
    currentWord = null;
    return null;
  }
  const idx = Math.floor(Math.random() * playable.length);
  currentWord = playable[idx];
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
  currentSlots = Array.from({ length: word.length }, () => "");
  answerSlotsEl.innerHTML = "";

  for (let i = 0; i < word.length; i++) {
    const span = document.createElement("span");
    span.className = "answer-slot";
    span.textContent = "";
    answerSlotsEl.appendChild(span);
  }

  // Show first letter hint on the right
  hintLetterEl.textContent = word[0] || "";
  messageEl.textContent = "";
}

function handleLetterClick(letter) {
  if (!currentWord) {
    messageEl.textContent = "Add some words in settings first.";
    return;
  }

  speakLetter(letter);

  const word = currentWord.word;
  // find first empty slot
  const emptyIndex = currentSlots.findIndex(v => v === "");
  if (emptyIndex === -1) return; // already full

  currentSlots[emptyIndex] = letter;
  const span = answerSlotsEl.children[emptyIndex];
  span.textContent = letter;

  if (currentSlots.every(v => v !== "")) {
    const guess = currentSlots.join("");
    if (guess === word) {
      messageEl.textContent = "✅ Correct!";
      speakText(word);
      // Load another word after short pause
      setTimeout(() => {
        pickRandomWord();
        setupWordDisplay();
      }, 800);
    } else {
      messageEl.textContent = "❌ Try again!";
      // Clear slots (but keep hint)
      setTimeout(() => {
        currentSlots = currentSlots.map(() => "");
        Array.from(answerSlotsEl.children).forEach(span => (span.textContent = ""));
        messageEl.textContent = "";
      }, 700);
    }
  }
}

// ====== SETTINGS UI ======
function openSettings() {
  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
}

function closeSettingsModal() {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
}

function refreshWordList() {
  wordListEl.innerHTML = "";
  if (words.length === 0) {
    wordListEl.textContent = "No words saved yet.";
    return;
  }
  words.forEach(w => {
    const div = document.createElement("div");
    div.className = "word-item";
    const left = document.createElement("span");
    left.textContent = `${w.word} (${w.category})`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑";
    delBtn.style.border = "none";
    delBtn.style.background = "transparent";
    delBtn.style.cursor = "pointer";
    delBtn.addEventListener("click", () => deleteWord(w.id));
    div.appendChild(left);
    div.appendChild(delBtn);
    wordListEl.appendChild(div);
  });
}

function refreshCategoryFilter() {
  const categories = [...new Set(words.map(w => w.category))].sort();
  const current = categoryFilter.value || "ALL";

  categoryFilter.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "ALL";
  allOpt.textContent = "ALL";
  categoryFilter.appendChild(allOpt);

  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  categoryFilter.value = categories.includes(current) ? current : "ALL";
  categoryFilterValue = categoryFilter.value;
}

function deleteWord(id) {
  words = words.filter(w => w.id !== id);
  saveWordsToStorage();
  refreshWordList();
  refreshCategoryFilter();
  pickRandomWord();
  setupWordDisplay();
}

function handleAddWord() {
  const category = (categoryInput.value || "GENERAL").trim().toUpperCase();
  const word = (wordInput.value || "").trim().toUpperCase();

  if (!word || !imageInput.files[0]) {
    alert("Please enter a WORD and choose an IMAGE.");
    return;
  }

  const file = imageInput.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const imageData = e.target.result;

    const newWord = {
      id: Date.now(),
      word,
      category,
      imageData
    };

    words.push(newWord);
    saveWordsToStorage();
    refreshWordList();
    refreshCategoryFilter();

    // Clear inputs
    wordInput.value = "";
    imageInput.value = "";

    // if it was the first word, start game
    if (!currentWord) {
      pickRandomWord();
      setupWordDisplay();
    }
  };
  reader.readAsDataURL(file);
}

// ====== EVENT LISTENERS ======
settingsButton.addEventListener("click", openSettings);
closeSettings.addEventListener("click", closeSettingsModal);
settingsModal
  .querySelector(".modal-backdrop")
  .addEventListener("click", closeSettingsModal);

addWordButton.addEventListener("click", handleAddWord);

categoryFilter.addEventListener("change", () => {
  categoryFilterValue = categoryFilter.value;
  pickRandomWord();
  setupWordDisplay();
});

// ====== INIT ======
window.addEventListener("load", () => {
  // Needed on iOS so voices list is populated
  window.speechSynthesis.getVoices();
});

loadWordsFromStorage();
createKeyboard();
refreshWordList();
refreshCategoryFilter();
pickRandomWord();
setupWordDisplay();
