// Inizializza il socket per la comunicazione WebSocket
const socket = io({ path: "/quiz/socket.io" });

// Estrae i parametri dalla URL (nome utente e codice sessione)
const urlParams = new URLSearchParams(window.location.search);
const name = urlParams.get("name") || "";

const titleElement = document.getElementById("waitingTitle");
if (titleElement && name) {
 titleElement.textContent = `Ciao ${name.toUpperCase()}, attendi l'avvio del quiz!`;
}

const sessionId = urlParams.get("sessionId");

// Se manca il sessionId, mostra un messaggio di errore
if (!sessionId) {
 document.body.innerHTML = "<h2 class='text-danger'>Sessione non trovata</h2>";
} else {
 // Mostra il codice sessione sulla pagina
 document.getElementById("sessionIdText").textContent = sessionId;

 // Registra il partecipante al server tramite WebSocket
 if (name) {
  socket.emit("register", name, sessionId);
 }
}

// Array per tenere traccia delle bolle animate dei partecipanti
let bubbles = [];
// ID dell'animazione corrente, utile per annullare animazioni precedenti
let animationFrameId;

// Gestisce l'arrivo dell'elenco partecipanti dal server
socket.on("participants", (participants) => {
 const cloud = document.getElementById("participantsCloud");
 cloud.innerHTML = "";

 // Aggiorna il contatore dei partecipanti se presente
 const countElement = document.getElementById("participantCount");
 if (countElement) {
  countElement.textContent = participants.length;
 }
 if (window.innerWidth <= 768 && participants.length > 15) {
  cloud.style.height = "200vh";
 } else {
  // Altrimenti usa la dimensione standard
  cloud.style.height = "";
 }
 // Ferma eventuali animazioni precedenti
 cancelAnimationFrame(animationFrameId);
 bubbles = [];

 const cloudWidth = cloud.offsetWidth;
 const cloudHeight = cloud.offsetHeight;

 // Determina dimensioni dinamiche in base al numero di partecipanti
 let size = 50;
 let fontSize = 12;
 if (participants.length > 20) {
  size = 30;
  fontSize = 10;
 } else if (participants.length > 10) {
  size = 40;
  fontSize = 11;
 }

 // Crea una bolla visiva animata per ogni partecipante
 participants.forEach((p) => {
  const div = document.createElement("div");
  div.className = "participant-bubble";
  
  // Evidenzia la propria bolla con una classe speciale
  if (p.name === name) {
   div.classList.add("own-participant");
  }
  
  div.textContent = p.name.toUpperCase();

  const color = `hsl(${Math.floor(Math.random() * 360)}, 60%, 40%)`;

  // Applica gli stili
  div.style.backgroundColor = color;
  div.style.width = `${size * 2}px`;
  div.style.height = `${size * 2}px`;
  div.style.fontSize = `${fontSize}px`;
  div.style.borderRadius = "50%";
  div.style.display = "flex";
  div.style.alignItems = "center";
  div.style.justifyContent = "center";
  div.style.textAlign = "center";
  div.style.padding = "5px";
  div.style.lineHeight = "1.2";
  div.style.wordBreak = "break-word";
  div.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.2)";

  // Calcolo posizione iniziale che non si sovrapponga
  let x,
   y,
   overlapping,
   attempts = 0;
  do {
   x = Math.random() * (cloudWidth - size * 2);
   y = Math.random() * (cloudHeight - size * 2);
   overlapping = bubbles.some((b) => {
    const dx = b.x - x;
    const dy = b.y - y;
    return Math.hypot(dx, dy) < size * 2;
   });
   attempts++;
  } while (overlapping && attempts < 100);

  div.style.transform = `translate(${x}px, ${y}px)`;
  cloud.appendChild(div);

  bubbles.push({
   el: div,
   x,
   y,
   vx: (Math.random() - 0.5) * 2,
   vy: (Math.random() - 0.5) * 2,
   size,
  });
 });

 // Avvia l'animazione
 animate();
});

// Funzione ricorsiva che anima il movimento delle bolle
function animate() {
 const cloud = document.getElementById("participantsCloud");
 const width = cloud.offsetWidth;
 const height = cloud.offsetHeight;

 bubbles.forEach((b1, i) => {
  // Aggiorna la posizione
  b1.x += b1.vx;
  b1.y += b1.vy;

  // Rimbalzo sui bordi del contenitore
  if (b1.x <= 0 || b1.x + b1.size * 2 >= width) b1.vx *= -1;
  if (b1.y <= 0 || b1.y + b1.size * 2 >= height) b1.vy *= -1;

  // Gestione collisioni con altre bolle
  for (let j = i + 1; j < bubbles.length; j++) {
   const b2 = bubbles[j];
   const dx = b2.x - b1.x;
   const dy = b2.y - b1.y;
   const dist = Math.hypot(dx, dy);

   if (dist < b1.size * 2) {
    // Scambia le velocità (collisione elastica semplificata)
    const tempVx = b1.vx;
    const tempVy = b1.vy;
    b1.vx = b2.vx;
    b1.vy = b2.vy;
    b2.vx = tempVx;
    b2.vy = tempVy;
   }
  }

  // Applica la nuova posizione alla bolla
  b1.el.style.transform = `translate(${b1.x}px, ${b1.y}px)`;
 });

 // Richiama l'animazione al frame successivo
 animationFrameId = requestAnimationFrame(animate);
}

// Quando il server avvia il quiz, si passa alla pagina del partecipante
socket.on("quizData", () => {
 window.location.href = `/quiz/participant.html?name=${encodeURIComponent(
  name
 )}&sessionId=${encodeURIComponent(sessionId)}`;
});
