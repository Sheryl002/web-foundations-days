// ===== Starting data =====
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const CATEGORIES = ["personal", "work", "study"];

// ===== Functions =====

// Returns notes whose text contains the word (ignoring case)
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter(function (note) {
    return note.text.toLowerCase().includes(search);
  });
}

// Returns the note with the most characters, or null if there are none
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }
  return longest;
}

// Returns an object counting notes per category
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category]) {
      counts[note.category] += 1;
    } else {
      counts[note.category] = 1;
    }
  }
  return counts;
}

// Returns a sentence such as "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const total = notes.length;
  const word = total === 1 ? "note" : "notes";
  if (total === 0) {
    return `${total} ${word}.`;
  }
  const counts = countByCategory();
  const parts = [];
  for (const category of CATEGORIES) {
    if (counts[category]) {
      parts.push(`${counts[category]} ${category}`);
    }
  }
  return `${total} ${word}: ${parts.join(", ")}.`;
}

// Makes text lower case, trimmed, with extra spaces collapsed
function normalise(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Returns true if a note with the same text already exists
function isDuplicate(text) {
  const wanted = normalise(text);
  return notes.some(function (note) {
    return normalise(note.text) === wanted;
  });
}

// Adds a note if valid. Returns true when added, false otherwise
function addNote(text, category) {
  const cleanText = text.trim();

  if (cleanText.length < 1 || cleanText.length > 200) {
    console.log("Not added: text must be 1-200 characters.");
    return false;
  }
  if (!CATEGORIES.includes(category)) {
    console.log("Not added: category must be personal, work or study.");
    return false;
  }
  if (isDuplicate(cleanText)) {
    console.log("Not added: this note already exists.");
    return false;
  }

  const newId = notes.length > 0 ? notes[notes.length - 1].id + 1 : 1;
  notes.push({ id: newId, text: cleanText, category: category });
  return true;
}

// ===== Tests =====

// searchNotes
console.log(searchNotes("milk"));
// Expected: [ { id: 1, text: "Buy milk and bread", category: "personal" } ]
console.log(searchNotes("JAVASCRIPT"));
// Expected: [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]
console.log(searchNotes("xyz"));
// Expected: [] (no results)

// longestNote
console.log(longestNote());
// Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
const savedNotes = notes;
notes = [];
console.log(longestNote());
// Expected: null (no notes)
notes = savedNotes;

// countByCategory
console.log(countByCategory());
// Expected: { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory());
// Expected: {} (no notes)
notes = savedNotes;

// getSummary
console.log(getSummary());
// Expected: "5 notes: 2 personal, 1 work, 2 study."
notes = [savedNotes[0]];
console.log(getSummary());
// Expected: "1 note: 1 personal."
notes = [];
console.log(getSummary());
// Expected: "0 notes."
notes = savedNotes;

// isDuplicate
console.log(isDuplicate("  BUY   milk and BREAD "));
// Expected: true (ignores case and extra spaces)
console.log(isDuplicate("Walk the dog"));
// Expected: false

// addNote
console.log(addNote("Walk the dog", "personal"));
// Expected: true
console.log(addNote("walk the dog", "personal"));
// Expected: "Not added: this note already exists." then false
console.log(addNote("   ", "work"));
// Expected: "Not added: text must be 1-200 characters." then false
console.log(addNote("a".repeat(201), "work"));
// Expected: "Not added: text must be 1-200 characters." then false
console.log(addNote("Go to the gym", "hobby"));
// Expected: "Not added: category must be personal, work or study." then false

// Summary after the successful add
console.log(getSummary());
// Expected: "6 notes: 3 personal, 1 work, 2 study."
