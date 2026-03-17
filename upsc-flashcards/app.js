const GOOGLE_SHEET_ID = '12PVJKdL7yL--R5xmIH3D0y88V9Vj2yNyBZrWuj2oiv8';
const GOOGLE_SHEET_GID = '0';
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${GOOGLE_SHEET_GID}`;

const STORAGE_KEY = 'upsc_flashcard_responses_v1';

const loadSheetBtn = document.getElementById('loadSheetBtn');
const sheetStatus = document.getElementById('sheetStatus');
const fileInput = document.getElementById('excelFile');
const fileStatus = document.getElementById('fileStatus');
const subjectSelect = document.getElementById('subjectSelect');
const flashcardPanel = document.getElementById('flashcard-panel');
const progressText = document.getElementById('progressText');
const questionText = document.getElementById('questionText');
const ohNoBtn = document.getElementById('ohNoBtn');
const ohYesBtn = document.getElementById('ohYesBtn');
const nextBtn = document.getElementById('nextBtn');
const retryNoBtn = document.getElementById('retryNoBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBacklogBtn = document.getElementById('clearBacklogBtn');
const summaryText = document.getElementById('summaryText');
const backlogText = document.getElementById('backlogText');

let allQuestions = [];
let activeSubject = '';
let activeQuestions = [];
let currentIndex = 0;
let responses = [];
let reviewMode = 'all';

const normalizeKey = (key) => String(key || '').trim().toLowerCase();
const normalizeText = (value) => String(value || '').trim();
const questionKey = (subject, question) => `${subject}|||${question}`;

function getStoredResponses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Could not parse local storage responses', error);
    return [];
  }
}

function setStoredResponses(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function parseRows(rows) {
  return rows
    .map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [normalizeKey(k), normalizeText(v)])
      );

      return {
        subject: normalized.subject || normalized.sub || normalized.topic || '',
        question: normalized.question || normalized.questions || normalized.prompt || ''
      };
    })
    .filter((q) => q.subject && q.question);
}

function parseCsvToRows(csvText) {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
}

function applyQuestions(list, sourceLabel) {
  allQuestions = list;

  if (!allQuestions.length) {
    resetSubjectData();
    return;
  }

  const subjects = [...new Set(allQuestions.map((q) => q.subject))].sort((a, b) => a.localeCompare(b));

  subjectSelect.innerHTML = '<option value="">Select a subject</option>';
  subjects.forEach((subject) => {
    const count = allQuestions.filter((q) => q.subject === subject).length;
    const option = document.createElement('option');
    option.value = subject;
    option.textContent = `${subject} (${count})`;
    subjectSelect.appendChild(option);
  });

  subjectSelect.disabled = false;
  sheetStatus.textContent = `Loaded ${allQuestions.length} questions from ${sourceLabel}.`;
  resetFlashcards();
  updateBacklogInfo();
}

async function loadFromGoogleSheet() {
  loadSheetBtn.disabled = true;
  sheetStatus.textContent = 'Loading from Google Sheet...';

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const csv = await response.text();
    const rows = parseCsvToRows(csv);
    const parsedQuestions = parseRows(rows);

    if (!parsedQuestions.length) {
      sheetStatus.textContent = 'No valid rows in sheet. Make sure columns include subject + question.';
      resetSubjectData();
      return;
    }

    applyQuestions(parsedQuestions, 'Google Sheet');
  } catch (error) {
    console.error(error);
    sheetStatus.textContent =
      'Could not load Google Sheet in this browser/network. Use Excel upload fallback below.';
    resetSubjectData();
  } finally {
    loadSheetBtn.disabled = false;
  }
}

loadSheetBtn.addEventListener('click', loadFromGoogleSheet);

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    const parsedQuestions = parseRows(rows);

    if (!parsedQuestions.length) {
      fileStatus.textContent = 'No valid rows found. Please keep subject/question columns.';
      resetSubjectData();
      return;
    }

    fileStatus.textContent = `Loaded ${parsedQuestions.length} questions from ${file.name}.`;
    applyQuestions(parsedQuestions, file.name);
  } catch (error) {
    console.error(error);
    fileStatus.textContent = 'Could not read this file. Please upload a valid Excel file.';
    resetSubjectData();
  }
});

subjectSelect.addEventListener('change', () => {
  activeSubject = subjectSelect.value;
  if (!activeSubject) {
    flashcardPanel.hidden = true;
    return;
  }

  reviewMode = 'all';
  responses = [];
  currentIndex = 0;
  activeQuestions = allQuestions.filter((q) => q.subject === activeSubject);

  flashcardPanel.hidden = activeQuestions.length === 0;
  renderQuestion();
  updateSummary();
  updateBacklogInfo();
});

function renderQuestion() {
  const current = activeQuestions[currentIndex];

  if (!current) {
    questionText.textContent = 'Done! You reached the end of this set.';
    progressText.textContent = `Completed ${activeQuestions.length}/${activeQuestions.length}`;
    ohNoBtn.disabled = true;
    ohYesBtn.disabled = true;
    nextBtn.disabled = true;
    downloadBtn.disabled = responses.length === 0;
    return;
  }

  questionText.textContent = current.question;
  progressText.textContent =
    `${reviewMode === 'backlog' ? 'Backlog' : 'Question'} ${currentIndex + 1} of ${activeQuestions.length}`;
  ohNoBtn.disabled = false;
  ohYesBtn.disabled = false;
  nextBtn.disabled = false;
}

function saveResponse(subject, question, choice) {
  const existing = getStoredResponses().filter((item) => item.key !== questionKey(subject, question));
  const entry = {
    key: questionKey(subject, question),
    subject,
    question,
    choice,
    updatedAt: new Date().toISOString()
  };

  setStoredResponses([...existing, entry]);
}

function recordChoice(choice) {
  const current = activeQuestions[currentIndex];
  if (!current) return;

  const entry = {
    subject: current.subject,
    question: current.question,
    choice,
    timestamp: new Date().toISOString()
  };

  responses.push(entry);
  saveResponse(current.subject, current.question, choice);

  currentIndex += 1;
  renderQuestion();
  updateSummary();
  updateBacklogInfo();
}

ohNoBtn.addEventListener('click', () => recordChoice('oh no'));
ohYesBtn.addEventListener('click', () => recordChoice('oh yes'));

nextBtn.addEventListener('click', () => {
  if (currentIndex < activeQuestions.length - 1) {
    currentIndex += 1;
    renderQuestion();
  }
});

retryNoBtn.addEventListener('click', () => {
  if (!activeSubject) return;

  const backlog = getStoredResponses()
    .filter((item) => item.subject === activeSubject && item.choice === 'oh no')
    .map((item) => ({ subject: item.subject, question: item.question }));

  if (!backlog.length) return;

  reviewMode = 'backlog';
  activeQuestions = backlog;
  currentIndex = 0;
  responses = [];
  flashcardPanel.hidden = false;
  renderQuestion();
  updateSummary();
});

clearBacklogBtn.addEventListener('click', () => {
  if (!activeSubject) return;

  const retained = getStoredResponses().filter(
    (item) => !(item.subject === activeSubject && item.choice === 'oh no')
  );

  setStoredResponses(retained);
  updateBacklogInfo();
});

downloadBtn.addEventListener('click', () => {
  const header = ['subject', 'question', 'choice', 'timestamp'];
  const csvRows = [header.join(',')].concat(
    responses.map((r) =>
      [r.subject, r.question, r.choice, r.timestamp]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
  );

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${activeSubject || 'upsc'}-responses.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

function updateSummary() {
  const yesCount = responses.filter((r) => r.choice === 'oh yes').length;
  const noCount = responses.filter((r) => r.choice === 'oh no').length;
  summaryText.textContent = `Oh Yes: ${yesCount}, Oh No: ${noCount}, Session responses: ${responses.length}.`;
  downloadBtn.disabled = responses.length === 0;
}

function updateBacklogInfo() {
  if (!activeSubject) {
    backlogText.textContent = 'Backlog: select a subject to view weak questions.';
    retryNoBtn.disabled = true;
    clearBacklogBtn.disabled = true;
    return;
  }

  const noCount = getStoredResponses().filter(
    (item) => item.subject === activeSubject && item.choice === 'oh no'
  ).length;

  backlogText.textContent = `Backlog for ${activeSubject}: ${noCount} question(s) marked "Oh No".`;
  retryNoBtn.disabled = noCount === 0;
  clearBacklogBtn.disabled = noCount === 0;
}

function resetSubjectData() {
  allQuestions = [];
  subjectSelect.innerHTML = '<option value="">Select a subject</option>';
  subjectSelect.disabled = true;
  resetFlashcards();
}

function resetFlashcards() {
  activeSubject = '';
  activeQuestions = [];
  currentIndex = 0;
  responses = [];
  reviewMode = 'all';
  flashcardPanel.hidden = true;
  updateBacklogInfo();
}

updateBacklogInfo();
