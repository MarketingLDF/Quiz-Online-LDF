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

  // Aggiunge il presentatore alla stanza e notifica la creazione
  socket.join(sessionId);
  socket.emit("sessionCreated", sessionId);
  log(`Sessione creata: ${sessionId} da ${socket.id}`);
 });

 socket.on("setQuestionDuration", ({ sessionId, duration }) => {
  if (sessions[sessionId]) {
   questionDurationPerSession[sessionId] = parseInt(duration) || 60;
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
  if (!sessions[sessionId]) return;

  const user = { id: socket.id, name };
  sessions[sessionId].participants.push(user);
  sessions[sessionId].scores[socket.id] = 0;
  socket.join(sessionId);

  // Notifica a tutti i partecipanti l'elenco aggiornato
  io.to(sessionId).emit("participants", sessions[sessionId].participants);
  log(`Utente ${name} registrato nella sessione ${sessionId}`);

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
  if (sessions[sessionId]) {
   selectedQuizFile[sessionId] = filename;
  }
 });

 // Il relatore può unirsi a una sessione esistente
 socket.on("joinPresenter", (sessionId) => {
  if (sessions[sessionId]) {
   socket.join(sessionId);
   socket.emit("sessionCreated", sessionId);
   io.to(sessionId).emit("participants", sessions[sessionId].participants);
  } else {
   socket.emit("error", "Sessione non trovata");
  }
 });

 socket.on("setScoreMode", ({ sessionId, mode }) => {
  if (!sessions[sessionId]) return;
  scoreModePerSession[sessionId] =
   mode === "parziale" ? "parziale" : "completo";
 });

 // Evento per l'avvio del quiz da parte del presentatore
 socket.on("startQuiz", (sessionId) => {
  if (!sessions[sessionId]) return;

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
