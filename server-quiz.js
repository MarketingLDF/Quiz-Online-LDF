// Import dei moduli necessari
const express = require("express"); // Web framework
const http = require("http"); // Server HTTP base di Node
const socketIO = require("socket.io"); // Libreria per WebSocket
const fs = require("fs"); // File system (lettura file quiz)
const path = require("path"); // Gestione percorsi file
const { log, scheduleMonthlyLogCleanup } = require("./logger"); // Logging personalizzato

// Setup iniziale
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = 4000;
let questionDurationPerSession = {};

// Avvia la pianificazione per la pulizia mensile dei log
scheduleMonthlyLogCleanup();

// Serve i file statici dalla cartella "public"
// app.use(express.static("public"));
app.use("/quiz", express.static(path.join(__dirname, "public")));

// Route per la root che reindirizza alla pagina principale
app.get("/", (req, res) => {
 res.redirect("/quiz/presenter.html");
});

io.attach(server, {
 path: "/quiz/socket.io",
});

// Oggetto che contiene tutte le sessioni attive
let sessions = {};
let scoreModePerSession = {};
let selectedQuizFile = {}; // sessionId -> filename

// Sistema di pulizia sessioni - configurazione
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minuti in millisecondi
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Controllo ogni 5 minuti
let sessionLastActivity = {}; // sessionId -> timestamp ultima attività

// Funzione per aggiornare l'ultima attività di una sessione
function updateSessionActivity(sessionId) {
  if (sessions[sessionId]) {
    sessionLastActivity[sessionId] = Date.now();
  }
}

// Funzione per pulire le sessioni inattive
function cleanupInactiveSessions() {
  const now = Date.now();
  const sessionsToDelete = [];
  
  for (const sessionId in sessions) {
    const lastActivity = sessionLastActivity[sessionId] || 0;
    const timeSinceLastActivity = now - lastActivity;
    
    // Se la sessione è inattiva da più del timeout configurato
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      sessionsToDelete.push(sessionId);
    }
  }
  
  // Rimuovi le sessioni inattive
  sessionsToDelete.forEach(sessionId => {
    const session = sessions[sessionId];
    const participantCount = session ? session.participants.length : 0;
    
    // Pulisci tutti i dati associati alla sessione
    delete sessions[sessionId];
    delete scoreModePerSession[sessionId];
    delete selectedQuizFile[sessionId];
    delete questionDurationPerSession[sessionId];
    delete sessionLastActivity[sessionId];
    
    log(`Sessione inattiva rimossa: ${sessionId} (${participantCount} partecipanti, inattiva da ${Math.round(timeSinceLastActivity / 60000)} minuti)`);
  });
  
  if (sessionsToDelete.length > 0) {
    log(`Pulizia completata: ${sessionsToDelete.length} sessioni rimosse`);
  }
}

// Avvia il timer per la pulizia automatica delle sessioni
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);
log(`Sistema di pulizia sessioni avviato: timeout ${SESSION_TIMEOUT/60000} minuti, controllo ogni ${CLEANUP_INTERVAL/60000} minuti`);

// Sistema di validazione degli input
function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: 'ID sessione mancante o non valido' };
  }
  
  // Rimuovo i vincoli di lunghezza - ora accetta da 1 carattere a illimitato
  if (sessionId.length < 1) {
    return { valid: false, error: 'ID sessione non può essere vuoto' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return { valid: false, error: 'ID sessione può contenere solo lettere, numeri, underscore e trattini' };
  }
  
  return { valid: true };
}

function validateParticipantName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nome partecipante mancante o non valido' };
  }
  
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 30) {
    return { valid: false, error: 'Nome partecipante deve essere tra 2 e 30 caratteri' };
  }
  
  if (!/^[a-zA-Z0-9\s\u00C0-\u017F_-]+$/.test(trimmedName)) {
    return { valid: false, error: 'Nome partecipante contiene caratteri non validi' };
  }
  
  return { valid: true, sanitized: trimmedName };
}

function validateQuestionDuration(duration) {
  const numDuration = parseInt(duration);
  if (isNaN(numDuration) || numDuration < 5 || numDuration > 300) {
    return { valid: false, error: 'Durata domanda deve essere tra 5 e 300 secondi' };
  }
  
  return { valid: true, sanitized: numDuration };
}

function validateScoreMode(mode) {
  if (!mode || typeof mode !== 'string') {
    return { valid: false, error: 'Modalità punteggio mancante' };
  }
  
  const validModes = ['completo', 'parziale'];
  if (!validModes.includes(mode)) {
    return { valid: false, error: 'Modalità punteggio non valida' };
  }
  
  return { valid: true, sanitized: mode };
}

function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Nome file mancante' };
  }
  
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(filename)) {
    return { valid: false, error: 'Nome file non valido (solo lettere, numeri, underscore, trattini e estensione .json)' };
  }
  
  if (filename.length > 100) {
    return { valid: false, error: 'Nome file troppo lungo (max 100 caratteri)' };
  }
  
  return { valid: true, sanitized: filename };
}

// Carica lista quiz disponibili
function getAvailableQuizzes() {
 const dir = "./quizzes";
 if (!fs.existsSync(dir)) return [];
 return fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((file) => {
   try {
    const content = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    return {
     filename: file,
     title: content.title || file,
    };
   } catch (e) {
    return null;
   }
  })
  .filter(Boolean);
}

// Gestione connessione WebSocket da parte di un client
io.on("connection", (socket) => {
 log(`Nuova connessione: ${socket.id}`);

 // Evento per la creazione di una nuova sessione
 socket.on("createSession", (sessionId) => {
  // Validazione input
  const validation = validateSessionId(sessionId);
  if (!validation.valid) {
   socket.emit("sessionError", validation.error);
   log(`Errore validazione sessione: ${validation.error} - Input: ${sessionId}`);
   return;
  }

  // Se la sessione esiste già, invia errore
  if (sessions[sessionId]) {
   socket.emit("sessionError", "Sessione già esistente");
   log(`Errore: sessione ${sessionId} già esistente`);
   return;
  }

  // Crea una nuova sessione
  sessions[sessionId] = {
   host: socket.id,
   participants: [],
   scores: {},
   currentQuestion: 0,
   quiz: [],
  };

  // Aggiorna l'attività della sessione
  updateSessionActivity(sessionId);

  // Aggiunge il presentatore alla stanza e notifica la creazione
  socket.join(sessionId);
  socket.emit("sessionCreated", sessionId);
  log(`Sessione creata: ${sessionId} da ${socket.id}`);
 });

 socket.on("setQuestionDuration", ({ sessionId, duration }) => {
  // Validazione input
  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.valid) {
   socket.emit("error", sessionValidation.error);
   return;
  }

  const durationValidation = validateQuestionDuration(duration);
  if (!durationValidation.valid) {
   socket.emit("error", durationValidation.error);
   return;
  }

  if (sessions[sessionId]) {
   questionDurationPerSession[sessionId] = durationValidation.sanitized;
   updateSessionActivity(sessionId);
  }
 });

 socket.on("uploadQuiz", ({ filename, content }) => {
  const dir = "./quizzes";
  const baseName = path.basename(filename, ".json");
  let finalName = baseName + ".json";
  let i = 1;

  while (fs.existsSync(path.join(dir, finalName))) {
   finalName = `${baseName}_${i++}.json`;
  }

  try {
   fs.writeFileSync(
    path.join(dir, finalName),
    JSON.stringify(content, null, 2),
    "utf8"
   );
   log(`Quiz caricato: ${finalName}`);
   socket.emit("quizList", getAvailableQuizzes()); // aggiorna lista
  } catch (e) {
   log(`Errore nel salvataggio quiz: ${e.message}`);
  }
 });

 // Evento per la registrazione di un partecipante a una sessione
 socket.on("register", (name, sessionId) => {
  // Validazione input
  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.valid) {
   socket.emit("error", sessionValidation.error);
   return;
  }

  const nameValidation = validateParticipantName(name);
  if (!nameValidation.valid) {
   socket.emit("error", nameValidation.error);
   return;
  }

  if (!sessions[sessionId]) {
   socket.emit("error", "Sessione non trovata");
   return;
  }

  // Controlla se il nome è già in uso nella sessione
  const existingParticipant = sessions[sessionId].participants.find(p => p.name.toLowerCase() === nameValidation.sanitized.toLowerCase());
  if (existingParticipant) {
   socket.emit("error", "Nome già in uso in questa sessione");
   return;
  }

  const user = { id: socket.id, name: nameValidation.sanitized };
  sessions[sessionId].participants.push(user);
  sessions[sessionId].scores[socket.id] = 0;
  socket.join(sessionId);

  // Aggiorna l'attività della sessione
  updateSessionActivity(sessionId);

  // Notifica a tutti i partecipanti l'elenco aggiornato
  io.to(sessionId).emit("participants", sessions[sessionId].participants);
  log(`Utente ${nameValidation.sanitized} registrato nella sessione ${sessionId}`);

  // Se il quiz è già in corso, invia subito i dati al nuovo partecipante
  const quiz = sessions[sessionId].quiz;
  if (quiz.length > 0) {
   socket.emit("quizData", {
    title: sessions[sessionId].quizTitle || "Quiz",
    questions: quiz,
    duration: questionDurationPerSession[sessionId] || 60, // ✅ AGGIUNTO
   });
   let index = sessions[sessionId].currentQuestion;
   if (index > 0) index--; // torna indietro di 1 se il quiz è partito
   if (index < quiz.length) {
    socket.emit("questionChange", index);
   } else {
    socket.emit("quizEnd");
   }
  }
 });

 socket.on("requestQuizList", () => {
  socket.emit("quizList", getAvailableQuizzes());
 });

 socket.on("selectQuiz", ({ sessionId, filename }) => {
  // Validazione input
  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.valid) {
   socket.emit("error", sessionValidation.error);
   return;
  }

  const filenameValidation = validateFilename(filename);
  if (!filenameValidation.valid) {
   socket.emit("error", filenameValidation.error);
   return;
  }

  if (sessions[sessionId]) {
   selectedQuizFile[sessionId] = filenameValidation.sanitized;
   updateSessionActivity(sessionId);
  }
 });

 // Il relatore può unirsi a una sessione esistente
 socket.on("joinPresenter", (sessionId) => {
  if (sessions[sessionId]) {
   socket.join(sessionId);
   updateSessionActivity(sessionId);
   socket.emit("sessionCreated", sessionId);
   io.to(sessionId).emit("participants", sessions[sessionId].participants);
  } else {
   socket.emit("error", "Sessione non trovata");
  }
 });

 socket.on("setScoreMode", ({ sessionId, mode }) => {
  // Validazione input
  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.valid) {
   socket.emit("error", sessionValidation.error);
   return;
  }

  const modeValidation = validateScoreMode(mode);
  if (!modeValidation.valid) {
   socket.emit("error", modeValidation.error);
   return;
  }

  if (!sessions[sessionId]) {
   socket.emit("error", "Sessione non trovata");
   return;
  }

  scoreModePerSession[sessionId] = modeValidation.sanitized;
  updateSessionActivity(sessionId);
 });

 // Evento per l'avvio del quiz da parte del presentatore
 socket.on("startQuiz", (sessionId) => {
  if (!sessions[sessionId]) return;

  updateSessionActivity(sessionId);
  const quizFile = selectedQuizFile[sessionId] || "quiz.json";
  const fullPath = path.join("./quizzes", quizFile);

  fs.readFile(fullPath, "utf8", (err, data) => {
   if (err) {
    log(`Errore nella lettura del quiz ${quizFile}: ${err.message}`);
    return;
   }

   try {
    const parsed = JSON.parse(data);
    const questions = parsed.questions || [];
    sessions[sessionId].quiz = questions;
    sessions[sessionId].quizTitle = parsed.title || "Quiz";
    sessions[sessionId].currentQuestion = 0;

    // Invia quiz completo ai client
    io.to(sessionId).emit("quizData", {
     title: parsed.title || "Quiz",
     questions,
     duration: questionDurationPerSession[sessionId] || 60,
    });

    // Invia direttamente la prima domanda
    io.to(sessionId).emit("questionChange", 0);
    sessions[sessionId].currentQuestion = 1;

    log(
     `Quiz «${parsed.title || quizFile}» avviato nella sessione ${sessionId}`
    );
   } catch (e) {
    log(`Errore parsing JSON del quiz ${quizFile}: ${e.message}`);
   }
  });
 });

 // Passa alla domanda successiva
 socket.on("nextQuestion", (sessionId) => {
  const session = sessions[sessionId];
  if (!session) return;

  updateSessionActivity(sessionId);
  const index = session.currentQuestion;

  // Se abbiamo finito le domande, termina il quiz
  if (index >= session.quiz.length) {
   io.to(sessionId).emit("quizEnd");
   log(`Fine quiz per la sessione ${sessionId}`);
  } else {
   // Altrimenti invia la nuova domanda
   io.to(sessionId).emit("questionChange", index);
   session.currentQuestion++;
   log(`Domanda ${index} inviata nella sessione ${sessionId}`);
  }
 });

 // Forza la fine del tempo per tutti i partecipanti
 socket.on("endTime", (sessionId) => {
  if (!sessions[sessionId]) return;

  updateSessionActivity(sessionId);
  io.to(sessionId).emit("forceDisable");
  log(`Timer scaduto nella sessione ${sessionId}`);
 });

 // Riceve la risposta di un partecipante
 socket.on("answer", (selectedAnswers) => {
  for (const sessionId in sessions) {
   const session = sessions[sessionId];
   const questionIndex = session.currentQuestion - 1;
   const question = session.quiz[questionIndex];

   if (!question || !Array.isArray(question.correct)) continue;

   const correct = [...question.correct].sort().join(",");
   const received = [...selectedAnswers].sort().join(",");
   const mode = scoreModePerSession[sessionId] || "completo";

   if (session.scores[socket.id] === undefined) continue;

   if (mode === "completo") {
    if (correct === received) {
     session.scores[socket.id] += 10;
    }
   } else if (mode === "parziale") {
    const correctSet = new Set(question.correct);
    const selectedSet = new Set(selectedAnswers);

    let score = 0;
    let total = correctSet.size;

    for (const ans of selectedSet) {
     if (correctSet.has(ans)) score += 1;
     else score -= 1;
    }

    const normalizedScore = Math.max(0, Math.round((score / total) * 10));
    session.scores[socket.id] += normalizedScore;
   }

   // Invia il punteggio aggiornato al partecipante
   socket.emit("scoreUpdate", session.scores[socket.id]);
  }
 });

 // Mostra la classifica finale
 socket.on("showRanking", (sessionId) => {
  const session = sessions[sessionId];
  if (!session) return;

  updateSessionActivity(sessionId);

  // Costruisce la classifica ordinata
  const ranking = session.participants
   .map((p) => ({
    name: p.name,
    score: session.scores[p.id] || 0,
   }))
   .sort((a, b) => b.score - a.score);

  io.to(sessionId).emit("ranking", ranking);
  log(`Classifica inviata per la sessione ${sessionId}`);
 });

 // Gestisce la disconnessione di un socket
 socket.on("disconnect", () => {
  log(`Socket disconnesso: ${socket.id}`);
  for (const sessionId in sessions) {
   const session = sessions[sessionId];
   const index = session.participants.findIndex((p) => p.id === socket.id);
   if (index !== -1) {
    session.participants.splice(index, 1);
    delete session.scores[socket.id];

    io.to(sessionId).emit("participants", session.participants);
    log(`Utente ${socket.id} rimosso dalla sessione ${sessionId}`);
   }
  }
 });
});

// Avvio del server sulla porta specificata
server.listen(PORT, () => {
 console.log(`Server listening on port ${PORT}`);
 log(`Server avviato sulla porta ${PORT}`);
});
