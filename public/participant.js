// Inizializza la connessione WebSocket al server
const socket = io({ path: "/quiz/socket.io" });

// Recupera i parametri dalla URL (nome e codice sessione)
const url = new URL(window.location.href);
const name = url.searchParams.get("name");
const sessionId = url.searchParams.get("sessionId");
let quizTitle = "Quiz";

// Se nome o sessione non sono presenti, mostra un messaggio di errore
if (!name || !sessionId) {
 document.body.innerHTML =
  "<h2 class='text-danger text-center'>Errore: nome o sessione mancante.</h2>";
} else {
 // Se tutto è valido, invia l'evento di registrazione al server
 socket.emit("register", name, sessionId);
}

// Variabili globali per tracciare lo stato del quiz
let questions = [];
let currentIndex = null;
let timerInterval = null;
let selectedAnswers = [];
let questionDuration = 60;

// Elementi del DOM principali usati durante il quiz
const questionEl = document.getElementById("question");
const answersEl = document.getElementById("answers");
const timerEl = document.getElementById("timer");
const bar = document.getElementById("bar");
const finalScoreEl = document.getElementById("finalScore");

// Riceve le domande dal server e le salva in memoria
socket.on("quizData", (data) => {
 questionDuration = data.duration || 60; // ✅ Prima di tutto

 if (data && Array.isArray(data.questions)) {
  questions = data.questions;
 } else {
  questions = [];
 }
 quizTitle = data?.title || "Quiz";
});

// Quando cambia la domanda corrente
socket.on("questionChange", (index) => {
 currentIndex = index;
 selectedAnswers = [];

 // Aggiorna il contatore visivo
 document.getElementById("questionCounter").textContent = `Domanda ${
  index + 1
 } di ${questions.length}`;

 // Se ci sono domande valide, le mostra
 if (questions.length > 0) {
  showQuestion();
  startTimer();
 }
});

let latestScore = null; // punteggio ricevuto ma non ancora mostrato

// Riceve il punteggio aggiornato ma NON lo mostra subito
socket.on("scoreUpdate", (score) => {
 latestScore = score;
});

// Forza la disattivazione dei pulsanti e mostra la risposta corretta
socket.on("forceDisable", () => {
 clearInterval(timerInterval);
 disableButtons();
 highlightCorrectAnswer();
 timerEl.textContent = "Tempo terminato!";
 bar.style.width = "0%";

 if (latestScore !== null) {
  showScore(latestScore);
  latestScore = null;
 }
});

// Quando il quiz è terminato
socket.on("quizEnd", () => {
 clearInterval(timerInterval);
 timerEl.textContent = "Il quiz è terminato.";
 bar.style.width = "0%";
});

// Mostra la classifica finale ricevuta dal server
socket.on("ranking", (ranking) => {
 // Nasconde gli elementi della domanda
 document.getElementById("questionCounter").style.display = "none";
 questionEl.textContent = "";
 answersEl.innerHTML = "<h4>Classifica Finale</h4>";
 timerEl.textContent = "";
 timerEl.style.display = "none";
 bar.style.width = "0%";
 bar.parentElement.style.display = "none";

 // 🎉 Confetti animati (15s) con stelle, cerchi ed effetto laterale
 const duration = 15000;
 const animationEnd = Date.now() + duration;

 const defaults = {
  spread: 360,
  ticks: 50,
  gravity: 0,
  decay: 0.94,
  startVelocity: 30,
  colors: ["FFE400", "FFBD00", "E89400", "FFCA6C", "FDFFB8"],
  zIndex: 0,
 };

 function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
 }

 const interval = setInterval(() => {
  const timeLeft = animationEnd - Date.now();
  if (timeLeft <= 0) {
   return clearInterval(interval);
  }

  const particleCount = 50 * (timeLeft / duration);

  confetti({
   ...defaults,
   particleCount,
   origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
  });

  confetti({
   ...defaults,
   particleCount,
   origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
  });
 }, 250);

 function shoot() {
  confetti({
   ...defaults,
   particleCount: 40,
   scalar: 1.2,
   shapes: ["star"],
  });

  confetti({
   ...defaults,
   particleCount: 10,
   scalar: 0.75,
   shapes: ["circle"],
  });
 }

 setTimeout(shoot, 0);
 setTimeout(shoot, 100);
 setTimeout(shoot, 200);

 // 🥇 Classifica finale animata dal basso
 let html = "<ol class='list-group'>";
 ranking.forEach((p, i) => {
  const delay = (ranking.length - 1 - i) * 300;

  let colorClass = "";
  if (i === 0) colorClass = "rank-gold";
  else if (i === 1) colorClass = "rank-silver";
  else if (i === 2) colorClass = "rank-bronze";

  html += `<li class="list-group-item d-flex justify-content-between align-items-center rank-item ${colorClass}" style="animation-delay: ${delay}ms;">
        ${p.name}<span class="badge bg-dark rounded-pill">${p.score}</span>
      </li>`;
 });
 html += "</ol>";

 finalScoreEl.innerHTML = html;
});

// Mostra la domanda corrente a schermo con tutte le risposte
function showQuestion() {
 const q = questions[currentIndex];
 questionEl.textContent = q.question;
 answersEl.innerHTML = "";
 finalScoreEl.innerHTML = "";
 selectedAnswers = [];

 // Crea un pulsante per ogni risposta possibile (a, b, c, d)
 ["a", "b", "c", "d"].forEach((letter) => {
  const btn = document.createElement("button");
  btn.textContent = q[letter];
  btn.id = `answer-${letter}`;
  btn.className = "btn btn-outline-primary";

  // Gestione selezione risposta multipla
  btn.onclick = () => {
   if (btn.disabled) return;

   if (selectedAnswers.includes(letter)) {
    selectedAnswers.splice(selectedAnswers.indexOf(letter), 1);
    btn.classList.remove("selected-answer");
   } else {
    selectedAnswers.push(letter);
    btn.classList.add("selected-answer");
   }
  };

  answersEl.appendChild(btn);
 });

 // Crea il pulsante per inviare la risposta al server
 const submitBtn = document.createElement("button");
 submitBtn.id = "submitAnswer";
 // submitBtn.className = "btn btn-success mt-5 submit-answer-btn";
 submitBtn.className =
  "btn btn-success mt-5 submit-answer-btn d-flex align-items-center justify-content-center gap-1";
 submitBtn.innerHTML = `
  <i class="bi bi-send-fill d-block" style="font-size: 1.5rem;"></i>
  <span>Invia Risposta</span>
`;

 submitBtn.onclick = () => {
  socket.emit("answer", selectedAnswers);
  disableButtons();
  timerEl.textContent = "Risposte inviate!";
  submitBtn.disabled = true;
  submitBtn.classList.remove("btn-success");
  submitBtn.classList.add("btn-secondary");

  const icon = submitBtn.querySelector("i");
  const textSpan = submitBtn.querySelector("span");

  if (icon) {
   icon.classList.add("fly-away");

   // Dopo 1s (durata animazione), rimuove l'icona e cambia il testo
   setTimeout(() => {
    icon.remove();
    if (textSpan) textSpan.textContent = "Risposta inviata!";
   }, 1000);
  }
 };

 answersEl.appendChild(submitBtn);
}

// Evidenzia le risposte selezionate dall'utente
function highlightSelectedAnswers(letters) {
 const correctAnswers = questions[currentIndex].correct;

 letters.forEach((letter) => {
  const btn = document.getElementById(`answer-${letter}`);
  if (!btn) return;

  // Rimuove stili predefiniti
  btn.classList.remove("btn-outline-primary", "btn-secondary");

  if (correctAnswers.includes(letter)) {
   btn.classList.add("correct-answer");
  } else {
   btn.classList.add("wrong-answer");
  }
 });
}

// Disabilita tutti i pulsanti delle risposte (usato dopo invio o timeout)
function disableButtons() {
 Array.from(answersEl.children).forEach((btn) => {
  if (btn.tagName === "BUTTON" && btn.id.startsWith("answer-")) {
   btn.disabled = true;
   btn.classList.remove("btn-outline-primary");
   btn.classList.add("btn-secondary");
  }
  if (btn.id === "submitAnswer") {
   btn.disabled = true;
   btn.classList.remove("btn-success");
   btn.classList.add("btn-secondary");
  }
 });
}

// Evidenzia le risposte corrette in verde
function highlightCorrectAnswer() {
 const correctAnswers = questions[currentIndex].correct;

 ["a", "b", "c", "d"].forEach((letter) => {
  const btn = document.getElementById(`answer-${letter}`);
  if (!btn) return;

  btn.classList.remove(
   "btn-outline-primary",
   "btn-secondary",
   "selected-answer"
  );

  if (selectedAnswers.includes(letter)) {
   if (correctAnswers.includes(letter)) {
    btn.classList.add("correct-answer"); // ✅ selezionata correttamente → verde con bordo
   } else {
    btn.classList.add("wrong-answer"); // ❌ sbagliata selezionata → rossa con bordo
   }
  } else {
   if (correctAnswers.includes(letter)) {
    btn.classList.add("btn-success"); // ✅ corretta NON selezionata → verde senza bordo
   } else {
    btn.classList.add("btn-secondary"); // ⚪ altro → grigio
   }
  }

  btn.disabled = true;
 });
}

// Avvia il conto alla rovescia del timer (60s)
function startTimer() {
 let seconds = questionDuration;
 clearInterval(timerInterval);
 timerEl.textContent = `Tempo: ${seconds}s`;
 bar.style.width = "100%";

 timerInterval = setInterval(() => {
  seconds--;
  timerEl.textContent = `Tempo: ${seconds}s`;
  bar.style.width = `${(seconds / questionDuration) * 100}%`;

  if (seconds <= 0) {
   clearInterval(timerInterval);
   disableButtons();
   highlightCorrectAnswer();
   timerEl.textContent = "Tempo scaduto!";
   bar.style.width = "0%";

   if (latestScore !== null) {
    showScore(latestScore);
    latestScore = null;
   }
  }
 }, 1000);
}

function showScore(score) {
 const scoreEl = document.getElementById("currentScore");
 if (scoreEl) {
  scoreEl.textContent = `Punteggio: ${score}`;
  scoreEl.style.display = "block";
 }
}
