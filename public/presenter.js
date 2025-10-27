document.addEventListener("DOMContentLoaded", () => {
 const socket = io({ path: "/quiz/socket.io" });

 const modal = document.getElementById("createSessionModal");
 const modalContent = document.getElementById("modalContent");
 const quizSelector = document.getElementById("quizSelector");
 const refreshQuizList = document.getElementById("refreshQuizList");
 let quizTitle = "Quiz";
 let questionDuration = 60;
 let currentSessionId = null;
 let questions = [];
 let qrCodeInstance = null;

 function loadQuizList() {
  socket.emit("requestQuizList");
 }
 refreshQuizList.addEventListener("click", loadQuizList);

 socket.on("quizList", (quizzes) => {
  quizSelector.innerHTML = `
      <option value="" disabled selected>Seleziona un quiz...</option>
    `;
  quizzes.forEach((q) => {
   const option = document.createElement("option");
   option.value = q.filename;
   option.textContent = `${q.title} (${q.filename})`;
   quizSelector.appendChild(option);
  });

  // Disabilita start finché non è stato selezionato un quiz
  document.getElementById("startQuiz").disabled = true;
 });

 // Invia la selezione del quiz scelto al server
 quizSelector.addEventListener("change", () => {
  const selected = quizSelector.value;
  if (selected) {
   quizSelector.classList.remove("blinking");
   quizSelector.classList.add("selected");

   socket.emit("selectQuiz", {
    sessionId: currentSessionId,
    filename: selected,
   });
   document.getElementById("startQuiz").disabled = false;
  }
 });

 // Richiede la lista iniziale dei quiz
 loadQuizList();

 // Mostra il modale quando si clicca il FAB
 document.getElementById("fab-button").addEventListener("click", () => {
  modal.style.display = "flex";

  quizSelector.classList.add("blinking");
  quizSelector.classList.remove("selected");

  if (!currentSessionId) {
   const sessionId = generateSessionId();
   currentSessionId = sessionId;
   socket.emit("createSession", sessionId);
  }
 });

 // Aggiunge e rimuove l’animazione di rotazione all’icona del FAB
 const fabButton = document.getElementById("fab-button");
 const fabIcon = document.getElementById("fab-icon");

 fabButton.addEventListener("click", () => {
  fabIcon.classList.add("spin");
  setTimeout(() => {
   fabIcon.classList.remove("spin");
  }, 1000);
 });

 // Chiude il modale cliccando la X
 document.getElementById("closeModal").addEventListener("click", () => {
  modal.style.display = "none";
 });

 // Chiude il modale cliccando fuori dal contenuto
 window.addEventListener("click", (e) => {
  if (e.target === modal) {
   modal.style.display = "none";
  }
 });

 // Crea una nuova sessione casuale
 document.getElementById("createSession").addEventListener("click", () => {
  const sessionId = generateSessionId();
  currentSessionId = sessionId; // <- AGGIUNGI QUESTO
  socket.emit("createSession", sessionId);
 });

 let audioEnabled = true;
 let quizStarted = false;

 const toggleAudioBtn = document.getElementById("toggleAudio");
 const audioIcon = document.getElementById("audioIcon");

 toggleAudioBtn.addEventListener("click", () => {
  audioEnabled = !audioEnabled;

  // Cambia icona e testo del bottone
  const iconClass = audioEnabled
   ? "bi bi-volume-up-fill"
   : "bi bi-volume-mute-fill";

  toggleAudioBtn.innerHTML = `<i class="${iconClass}" id="audioIcon"></i> ${
   audioEnabled ? "Audio Attivo" : "Audio Disattivo"
  }`;

  // Se l'audio è disattivato, ferma eventuali suoni in riproduzione
  if (!audioEnabled) {
   // Disattiva tutti i suoni
   joinSound.pause();
   joinSound.currentTime = 0;
   questionSound.pause();
   questionSound.currentTime = 0;
   rankingSound.pause();
   rankingSound.currentTime = 0;
  }
 });

 // Genera un codice sessione alfanumerico di 8 caratteri
 function generateSessionId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
   { length: 8 },
   () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
 }

 // Conferma o modifica un codice di sessione manuale
 document.getElementById("confirmCode").addEventListener("click", () => {
  const newCode = document
   .getElementById("codeDisplay")
   .value.trim()
   .toUpperCase();

  if (!/^[A-Z0-9_-]+$/.test(newCode) || newCode.length === 0) {
   alert("Il codice deve contenere solo caratteri alfanumerici, underscore (_) e trattini (-).");
   return;
  }

  currentSessionId = newCode;

  const baseUrl = window.location.origin;
  const newLink = `${baseUrl}/quiz/lobby.html?sessionId=${newCode}`;
  document.getElementById("linkInput").value = newLink;
  document.getElementById("codeDisplay").value = newCode;

  socket.emit("createSession", newCode);
  socket.emit("joinPresenter", newCode);

  // ✅ Reinvia la selezione del quiz se è stato scelto
  const selectedQuiz = quizSelector.value;
  if (selectedQuiz) {
   socket.emit("selectQuiz", {
    sessionId: newCode,
    filename: selectedQuiz,
   });
  }
 });

 // Recupera una sessione esistente
 document.getElementById("recoverCode").addEventListener("click", () => {
  const code = document
   .getElementById("codeDisplay")
   .value.trim()
   .toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(code) || code.length === 0) {
   alert("Il codice deve contenere solo caratteri alfanumerici, underscore (_) e trattini (-).");
   return;
  }

  currentSessionId = code;
  const baseUrl = window.location.origin;
  const link = `${baseUrl}/quiz/lobby.html?sessionId=${code}`;
  document.getElementById("linkInput").value = link;

  socket.emit("joinPresenter", code);
  modal.style.display = "none";
 });

 // Quando il server conferma la creazione della sessione
 socket.on("sessionCreated", (sessionId) => {
  const baseUrl = window.location.origin;
  const lobbyLink = `${baseUrl}/quiz/lobby.html?sessionId=${sessionId}`;
  document.getElementById("sessionLink").style.display = "block";
  document.getElementById("linkInput").value = lobbyLink;
  document.getElementById("codeDisplay").value = sessionId;
  document.getElementById("errorMessage").style.display = "none";
  currentSessionId = sessionId;
 });

 let presenterBubbles = [];
 let presenterAnimationId;
 let timerInterval = null;
 let currentIndex = null;
 let scoreMode = "completo"; // default

 const scoreToggleBtn = document.getElementById("scoreModeToggle");
 if (scoreToggleBtn) {
  scoreToggleBtn.addEventListener("click", () => {
   scoreMode = scoreMode === "completo" ? "parziale" : "completo";
   scoreToggleBtn.innerHTML = `<i class="bi bi-calculator"></i> Modalità punteggio: ${
    scoreMode.charAt(0).toUpperCase() + scoreMode.slice(1)
   }`;
  });
 }

 const joinSound = new Audio("media/541991__rob_marion__gasp_ui_pop_2.wav");
 joinSound.addEventListener('error', (e) => {
  console.warn('Errore nel caricamento del suono di ingresso:', e);
 });
 
 let lastParticipantCount = 0;
 let lastPlayTime = 0;
 const SOUND_COOLDOWN = 800;
 
 const questionSound = new Audio(
  "media/320533__timbre__pop-de-question-remix-of-freesound-202077.wav"
 );
 questionSound.volume = 0.2;
 questionSound.addEventListener('error', (e) => {
  console.warn('Errore nel caricamento del suono delle domande:', e);
 });
 
 const rankingSound = new Audio(
  "media/466133__humanoide9000__victory-fanfare.wav"
 );
 rankingSound.volume = 0.4;
 rankingSound.addEventListener('error', (e) => {
  console.warn('Errore nel caricamento del suono della classifica:', e);
 });

 // Funzione per auto-scroll verso i partecipanti
 function smoothScrollToParticipants() {
  const cloud = document.getElementById("participantsCloud");
  if (cloud) {
   cloud.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
   });
  }
 }

 // Riceve i partecipanti e li visualizza come bolle animate
 socket.on("participants", (participants) => {
  const newCount = participants.length;

  // Suono di ingresso (limitato nel tempo)
  const now = Date.now();
  if (
   newCount > lastParticipantCount &&
   now - lastPlayTime > 1000 &&
   joinSound
  ) {
   try {
    joinSound.play().catch(e => console.warn('Errore nella riproduzione del suono di ingresso:', e));
   } catch (e) {
    console.warn('Errore nella riproduzione del suono di ingresso:', e);
   }
   lastPlayTime = now;
  }

  // Auto-scroll per seguire i nuovi partecipanti
  if (newCount > lastParticipantCount) {
   smoothScrollToParticipants();
  }

  lastParticipantCount = newCount;

  cancelAnimationFrame(presenterAnimationId);
  const cloud = document.getElementById("participantsCloud");
  cloud.innerHTML = "";
  presenterBubbles = [];

  // Imposta l'attributo data-participants per il CSS scaling
  cloud.setAttribute("data-participants", participants.length.toString());

  const cloudRect = cloud.getBoundingClientRect();

  // Calcola dimensioni dinamiche basate sul numero di partecipanti
  let size = 50;
  let fontSize = 12;
  
  if (participants.length > 30) {
   size = 25;
   fontSize = 9;
  } else if (participants.length > 20) {
   size = 30;
   fontSize = 10;
  } else if (participants.length > 10) {
   size = 40;
   fontSize = 11;
  } else if (participants.length > 5) {
   size = 45;
   fontSize = 12;
  }

  participants.forEach((p) => {
   const div = document.createElement("div");
   div.className = "participant-bubble";
   div.textContent = p.name.toUpperCase();

   // Genera colori più scuri per miglior contrasto con testo bianco
   const hue = Math.floor(Math.random() * 360);
   const saturation = 50 + Math.floor(Math.random() * 30); // 50-80% per colori più vivaci
   const lightness = 35 + Math.floor(Math.random() * 20); // 35-55% per tonalità più scure
   const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

   // Applica gli stili dinamici
   Object.assign(div.style, {
    backgroundColor: color,
    width: `${size * 2}px`,
    height: `${size * 2}px`,
    fontSize: `${fontSize}px`,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "8px",
    lineHeight: "1.2",
    wordBreak: "break-word",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    backdropFilter: "blur(5px)",
    transition: "all 0.3s ease",
    fontWeight: "600"
   });

   // Evita sovrapposizione iniziale con algoritmo migliorato
   let x, y, overlapping, attempts = 0;
   const maxAttempts = 150;
   const margin = 10; // Margine tra le bolle
   
   do {
    x = margin + Math.random() * (cloud.offsetWidth - size * 2 - margin * 2);
    y = margin + Math.random() * (cloud.offsetHeight - size * 2 - margin * 2);
    overlapping = presenterBubbles.some((b) => {
     const dx = b.x - x;
     const dy = b.y - y;
     return Math.hypot(dx, dy) < (size * 2 + margin);
    });
    attempts++;
   } while (overlapping && attempts < maxAttempts);

   div.style.transform = `translate(${x}px, ${y}px)`;
   cloud.appendChild(div);

   presenterBubbles.push({
    el: div,
    x,
    y,
    vx: (Math.random() - 0.5) * 1.5, // Velocità leggermente ridotta
    vy: (Math.random() - 0.5) * 1.5,
    size,
   });
  });

  animatePresenter();

  document.getElementById("participantCount").textContent = participants.length;
  document.getElementById("startQuiz").disabled = participants.length === 0;
 });

 // Anima il movimento delle bolle nella vista relatore
 function animatePresenter() {
  const cloud = document.getElementById("participantsCloud");
  const width = cloud.offsetWidth;
  const height = cloud.offsetHeight;

  presenterBubbles.forEach((b1, i) => {
   b1.x += b1.vx;
   b1.y += b1.vy;

   // Rimbalzo ai bordi con effetto elastico
   if (b1.x <= 0) {
    b1.x = 0;
    b1.vx *= -0.8; // Riduce la velocità per effetto smorzamento
   }
   if (b1.x + b1.size * 2 >= width) {
    b1.x = width - b1.size * 2;
    b1.vx *= -0.8;
   }
   if (b1.y <= 0) {
    b1.y = 0;
    b1.vy *= -0.8;
   }
   if (b1.y + b1.size * 2 >= height) {
    b1.y = height - b1.size * 2;
    b1.vy *= -0.8;
   }

   // Collisioni tra bolle con fisica migliorata
   for (let j = i + 1; j < presenterBubbles.length; j++) {
    const b2 = presenterBubbles[j];

    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const distance = Math.hypot(dx, dy);
    const minDistance = b1.size * 2;

    if (distance < minDistance && distance > 0) {
     // Calcola la sovrapposizione
     const overlap = minDistance - distance;
     const separationX = (dx / distance) * overlap * 0.5;
     const separationY = (dy / distance) * overlap * 0.5;

     // Separa le bolle
     b1.x -= separationX;
     b1.y -= separationY;
     b2.x += separationX;
     b2.y += separationY;

     // Scambia velocità con smorzamento per effetto realistico
     const tempVx = b1.vx;
     const tempVy = b1.vy;
     b1.vx = b2.vx * 0.9;
     b1.vy = b2.vy * 0.9;
     b2.vx = tempVx * 0.9;
     b2.vy = tempVy * 0.9;
    }
   }

   b1.el.style.transform = `translate(${b1.x}px, ${b1.y}px)`;
  });

  presenterAnimationId = requestAnimationFrame(animatePresenter);
 }

 const uploadInput = document.getElementById("uploadQuizInput");

 uploadInput.addEventListener("change", () => {
  const file = uploadInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
   try {
    const content = JSON.parse(e.target.result);
    if (
     typeof content.title !== "string" ||
     !Array.isArray(content.questions) ||
     !content.questions.every(
      (q) =>
       typeof q.question === "string" &&
       typeof q.a === "string" &&
       typeof q.b === "string" &&
       typeof q.c === "string" &&
       typeof q.d === "string" &&
       Array.isArray(q.correct)
     )
    ) {
     alert("Formato quiz non valido.");
     return;
    }

    socket.emit("uploadQuiz", {
     filename: file.name,
     content,
    });
   } catch (err) {
    alert("Errore nella lettura del file JSON.");
   }
  };

  reader.readAsText(file);
 });

 // Copia il link della sessione nella clipboard
 document.getElementById("copyLink").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("linkInput").value);
 });

 // Pulsante debug per aprire 20 partecipanti con nomi casuali
 document.getElementById("debugLaunch").addEventListener("click", () => {
  const baseUrl = window.location.origin;
  const sessionId = document
   .getElementById("codeDisplay")
   .value.trim()
   .toUpperCase();

  if (!/^[A-Z0-9_-]+$/i.test(sessionId)) {
   alert("Codice sessione non valido. Può contenere solo lettere, numeri, underscore e trattini.");
   return;
  }

  const names = [
   "DARIO",
   "LUCIA",
   "MARCO",
   "GIULIA",
   "LUCA",
   "ELENA",
   "DAVIDE",
   "SOFIA",
   "ANDREA",
   "CHIARA",
   "STEFANO",
   "ALICE",
   "MATTIA",
   "FRANCESCA",
   "GABRIELE",
   "SARA",
   "MATTEO",
   "GIORGIA",
   "FILIPPO",
   "MARTINA",
  ];

  names.forEach((name) => {
   window.open(
    `${baseUrl}/quiz/waiting_room.html?name=${name}&sessionId=${sessionId}`,
    "_blank"
   );
  });
 });

 // Avvia il quiz
 document.getElementById("startQuiz").addEventListener("click", () => {
  questionDuration =
   parseInt(document.getElementById("questionDuration").value) || 60;

  socket.emit("setQuestionDuration", {
   sessionId: currentSessionId,
   duration: questionDuration,
  });

  const selectedQuiz = quizSelector.value;

  if (!selectedQuiz) {
   alert("Seleziona un quiz prima di avviare il quiz.");
   return;
  }

  if (currentSessionId) {
   quizStarted = true;
   socket.emit("setScoreMode", {
    sessionId: currentSessionId,
    mode: scoreMode,
   });

   socket.emit("startQuiz", currentSessionId);

   document.getElementById("startQuiz").classList.add("hidden");
   document.getElementById("lobbySection").classList.add("hidden");
   document.getElementById("createSession").classList.add("hidden");
   document.getElementById("sessionLink").classList.add("hidden");
  }
 });

 // Passa alla domanda successiva
 const nextBtn = document.getElementById("nextQuestion");
 if (nextBtn) {
  nextBtn.addEventListener("click", () => {
   if (currentSessionId) {
    clearInterval(timerInterval);
    socket.emit("nextQuestion", currentSessionId);
   }
  });
 }

 // Termina il tempo e mostra la risposta corretta
 document.getElementById("endTime").addEventListener("click", () => {
  if (currentSessionId && timerActive) {
   clearInterval(timerInterval);
   timerActive = false;
   document.getElementById("timer").textContent = "Tempo terminato!";
   highlightCorrectAnswer();
   socket.emit("endTime", currentSessionId);

    // ✅ Disabilita il pulsante "Termina tempo" quando il timer scade
    const endTimeBtn = document.getElementById("endTime");
    if (endTimeBtn) endTimeBtn.disabled = true;

    const nextBtn = document.getElementById("nextQuestion");
   if (nextBtn) nextBtn.disabled = false;

    if (currentIndex === questions.length - 1) {
     const finalBox = document.getElementById("finalScoreBox");
     if (finalBox) finalBox.style.display = "block";

     const showRankingBtn = document.getElementById("showRanking");
     if (showRankingBtn) showRankingBtn.disabled = false;
    }
   }
 });

 // Mostra la classifica finale
 document.getElementById("showRanking").addEventListener("click", async () => {
  socket.emit("showRanking", currentSessionId);
  const questionBox = document.getElementById("questionBox");
  if (questionBox) questionBox.style.display = "none";

  // ✅ Scroll automatico verso il basso per mostrare la classifica
  setTimeout(() => {
   window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth'
   });
  }, 100); // Piccolo delay per permettere al DOM di aggiornarsi

  if (audioEnabled) {
   [joinSound, questionSound, rankingSound].forEach((sound) => {
    if (!sound.paused) {
     sound.pause();
     sound.currentTime = 0;
    }
   });

   try {
    await rankingSound.play();
   } catch (e) {
    console.warn("Errore nella riproduzione della fanfara:", e);
   }
  }
 });

 // Riceve le domande del quiz
 socket.on("quizData", (data) => {
  questions = data.questions;
  quizTitle = data.title || "Quiz";
 });

 // Mostra una nuova domanda
 socket.on("questionChange", (index) => {
  currentIndex = index;

  // Riproduce il suono se l'audio è abilitato
  if (audioEnabled) {
   questionSound.currentTime = 0;
   try {
    questionSound.play().catch(e => console.warn('Errore nella riproduzione del suono delle domande:', e));
   } catch (e) {
    console.warn('Errore nella riproduzione del suono delle domande:', e);
   }
  }

  showQuestion();
  startTimer();
 });

 // Mostra la schermata di fine quiz
 socket.on("quizEnd", () => {
  const questionControls = document.getElementById("questionControls");
  if (questionControls) questionControls.style.display = "none";

  const finalScoreBox = document.getElementById("finalScoreBox");
  if (finalScoreBox) {
   finalScoreBox.style.display = "block";
   finalScoreBox.classList.add("show");
  }
 });

 // Riceve e mostra la classifica
 socket.on("ranking", (ranking) => {
  document.getElementById("questionCounter").style.display = "none";
  const container = document.getElementById("finalScore");
  container.classList.add("show"); // Mostra la classifica finale
  container.innerHTML = `<h2>${quizTitle}</h2><h4>Classifica Finale</h4>`;

  // 🎉 Effetto confetti: LATERALE + STELLE
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

  const interval = setInterval(function () {
   const timeLeft = animationEnd - Date.now();
   if (timeLeft <= 0) {
    return clearInterval(interval);
   }

   const particleCount = 50 * (timeLeft / duration);

   confetti({
    ...defaults,
    particleCount,
    origin: {
     x: randomInRange(0.1, 0.3),
     y: Math.random() - 0.2,
    },
   });

   confetti({
    ...defaults,
    particleCount,
    origin: {
     x: randomInRange(0.7, 0.9),
     y: Math.random() - 0.2,
    },
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

  if (audioEnabled) {
   joinSound.pause();
   joinSound.currentTime = 0;
   questionSound.pause();
   questionSound.currentTime = 0;
   rankingSound.pause();
   rankingSound.currentTime = 0;

   try {
    rankingSound.play().catch(e => console.warn('Errore nella riproduzione del suono della classifica:', e));
   } catch (e) {
    console.warn('Errore nella riproduzione del suono della classifica:', e);
   }
  }

  // 🥇 Classifica: ordinata, ma animata dal basso verso l’alto
  let html = "<ol class='list-group'>";
  ranking.forEach((p, i) => {
   const delay = (ranking.length - 1 - i) * 300;

   let colorClass = "";
   if (i === 0) colorClass = "rank-gold";
   else if (i === 1) colorClass = "rank-silver";
   else if (i === 2) colorClass = "rank-bronze";

   html += `
      <li class="list-group-item d-flex justify-content-between align-items-center rank-item ${colorClass}" style="animation-delay: ${delay}ms;">
        ${p.name}<span class="badge bg-dark rounded-pill">${p.score}</span>
      </li>`;
  });
  html += "</ol>";

  container.innerHTML += html;
 });

 // Mostra la domanda corrente a schermo
 function showQuestion() {
  document.getElementById("questionCounter").textContent = `Domanda ${
   currentIndex + 1
  } di ${questions.length}`;
  const q = questions[currentIndex];
  document.getElementById("questionBox").style.display = "block";
  document.getElementById("questionControls").style.display = "block";
  document.getElementById("questionText").textContent = q.question;

  const answers = document.getElementById("answers");
  answers.innerHTML = "";

  ["a", "b", "c", "d"].forEach((letter) => {
   const btn = document.createElement("button");
   btn.textContent = q[letter];
   btn.className = "btn btn-outline-secondary";
   btn.id = `answer-${letter}`;
   btn.disabled = true;
   answers.appendChild(btn);
  });

  document.getElementById("timer").textContent = "";
  document.getElementById("bar").style.width = "100%";

  const isLastQuestion = currentIndex === questions.length - 1;

  const nextBtn = document.getElementById("nextQuestion");
  if (nextBtn) {
   nextBtn.style.display = isLastQuestion ? "none" : "inline-block";
   nextBtn.disabled = true;
  }

  const showRankingBtn = document.getElementById("showRanking");
  if (showRankingBtn) {
   // Sempre disabilitato all'inizio di ogni domanda
   showRankingBtn.disabled = true;
  }

  // ✅ Riabilita il pulsante "Termina tempo" all'inizio di ogni domanda
  const endTimeBtn = document.getElementById("endTime");
  if (endTimeBtn) endTimeBtn.disabled = false;

  const finalBox = document.getElementById("finalScoreBox");
  if (finalBox) {
   // Non nascondere il finalScoreBox se è già visibile (dopo che il timer è scaduto)
   if (!isLastQuestion) {
    finalBox.style.display = "none";
    finalBox.classList.remove("show");
   }
  }
 }

 // Avvia il timer
 function startTimer() {
  let seconds = questionDuration;

  timerActive = true;
  clearInterval(timerInterval);

  document.getElementById("timer").textContent = `Tempo: ${seconds}s`;
  document.getElementById("bar").style.width = "100%";

  timerInterval = setInterval(() => {
   seconds--;
   document.getElementById("timer").textContent = `Tempo: ${seconds}s`;
   document.getElementById("bar").style.width = `${
    (seconds / questionDuration) * 100
   }%`;

   if (seconds <= 0) {
    clearInterval(timerInterval);
    timerActive = false;
    document.getElementById("timer").textContent = "Tempo scaduto!";
    document.getElementById("bar").style.width = "0%";
    highlightCorrectAnswer();
    socket.emit("endTime", currentSessionId);

    // ✅ Disabilita il pulsante "Termina tempo" quando il timer scade automaticamente
    const endTimeBtn = document.getElementById("endTime");
    if (endTimeBtn) endTimeBtn.disabled = true;

    const nextBtn = document.getElementById("nextQuestion");
    if (nextBtn) nextBtn.disabled = false;

    if (currentIndex === questions.length - 1) {
     const finalBox = document.getElementById("finalScoreBox");
     if (finalBox) {
      finalBox.style.display = "block";
      finalBox.classList.add("show");
     }

     const showRankingBtn = document.getElementById("showRanking");
     if (showRankingBtn) showRankingBtn.disabled = false; // ✅ attivalo solo qui
    }
   }
  }, 1000);
 }

 // Evidenzia la risposta corretta alla fine del tempo
 function highlightCorrectAnswer() {
  const correctAnswers = questions[currentIndex].correct;
  correctAnswers.forEach((letter) => {
   const btn = document.getElementById(`answer-${letter}`);
   if (btn) {
    btn.classList.remove("btn-outline-secondary");
    btn.classList.add("btn-success");
   }
  });
 }

 // ===== QR Code Functionality =====
 
 // Show QR Code Modal
 document.getElementById("showQRCode").addEventListener("click", () => {
  if (!currentSessionId) {
   alert("Nessuna sessione attiva. Crea prima una sessione.");
   return;
  }
  
  showQRCodeModal();
 });

 // Close QR Code Modal
 document.getElementById("closeQRModal").addEventListener("click", () => {
  hideQRCodeModal();
 });

 // Close modal when clicking outside
 document.getElementById("qrModal").addEventListener("click", (e) => {
  if (e.target.id === "qrModal") {
   hideQRCodeModal();
  }
 });

 // Show modal with high brightness by default
 function showQRCodeModal() {
  const modal = document.getElementById("qrModal");
  const sessionCodeSpan = document.getElementById("qrSessionCode");
  const sessionUrlSpan = document.getElementById("qrSessionUrl");
  const qrContainer = document.getElementById("qrCodeContainer");
  
  // Set session information
  sessionCodeSpan.textContent = currentSessionId;
  const sessionUrl = `${window.location.origin}/quiz/waiting_room.html?sessionId=${currentSessionId}`;
  sessionUrlSpan.textContent = sessionUrl;
  
  // Clear previous QR code
  qrContainer.innerHTML = "";
  
  // Generate QR Code
  try {
   qrCodeInstance = new QRCode(qrContainer, {
    text: sessionUrl,
    width: 400,
    height: 400,
    colorDark: "#2c3e50",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
   });
  } catch (error) {
   console.error("Errore nella generazione del QR Code:", error);
   qrContainer.innerHTML = `
    <div style="padding: 2rem; color: #dc3545;">
     <i class="bi bi-exclamation-triangle" style="font-size: 3rem;"></i>
     <p>Errore nella generazione del QR Code</p>
     <p style="font-size: 0.9rem;">Assicurati che la libreria QRCode.js sia caricata</p>
    </div>
   `;
  }
  
  // Show modal with high brightness by default
  modal.style.display = "flex";
  modal.classList.add("brightness-high");
  
  // Add fade-in animation
  setTimeout(() => {
   modal.style.opacity = "1";
  }, 10);
 }

 // Download QR Code
 document.getElementById("downloadQR").addEventListener("click", () => {
  if (qrCodeInstance) {
   const canvas = document.querySelector("#qrCodeContainer canvas");
   if (canvas) {
    const link = document.createElement("a");
    link.download = `QR-Code-Session-${currentSessionId}.png`;
    link.href = canvas.toDataURL();
    link.click();
   }
  }
 });

 function showQRCodeModal() {
  const modal = document.getElementById("qrModal");
  const sessionCodeSpan = document.getElementById("qrSessionCode");
  const sessionUrlSpan = document.getElementById("qrSessionUrl");
  const qrContainer = document.getElementById("qrCodeContainer");
  
  // Set session information
  sessionCodeSpan.textContent = currentSessionId;
  const sessionUrl = `${window.location.origin}/quiz/waiting_room.html?sessionId=${currentSessionId}`;
  sessionUrlSpan.textContent = sessionUrl;
  
  // Clear previous QR code
  qrContainer.innerHTML = "";
  
  // Generate QR Code
  try {
   qrCodeInstance = new QRCode(qrContainer, {
    text: sessionUrl,
    width: 400,
    height: 400,
    colorDark: "#2c3e50",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
   });
  } catch (error) {
   console.error("Errore nella generazione del QR Code:", error);
   qrContainer.innerHTML = `
    <div style="padding: 2rem; color: #dc3545;">
     <i class="bi bi-exclamation-triangle" style="font-size: 3rem;"></i>
     <p>Errore nella generazione del QR Code</p>
     <p style="font-size: 0.9rem;">Assicurati che la libreria QRCode.js sia caricata</p>
    </div>
   `;
  }
  
  // Show modal with high brightness by default
  modal.style.display = "flex";
  modal.classList.add("brightness-high");
  
  // Add fade-in animation
  setTimeout(() => {
   modal.style.opacity = "1";
  }, 10);
 }

 function hideQRCodeModal() {
  const modal = document.getElementById("qrModal");
  
  // Add fade-out animation
  modal.style.opacity = "0";
  
  setTimeout(() => {
   modal.style.display = "none";
   modal.classList.remove("brightness-high");
   
   // Clear QR code instance
   qrCodeInstance = null;
  }, 300);
 }

 // Keyboard shortcuts for QR modal
 document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("qrModal");
  if (modal.style.display === "flex") {
   if (e.key === "Escape") {
    hideQRCodeModal();
   } else if (e.key === "d" || e.key === "D") {
    document.getElementById("downloadQR").click();
   }
  }
 });
});
