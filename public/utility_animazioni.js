// Genera un colore HSL più scuro per miglior contrasto con testo bianco
function generaColorePastello() {
 return `hsl(${Math.floor(Math.random() * 360)}, 60%, 40%)`;
}

// Crea una bolla DOM con stile standard
function creaBollaPartecipante(nome, colore, size = 50) {
 const div = document.createElement("div");
 div.className = "participant-bubble";
 div.textContent = nome.toUpperCase();

 Object.assign(div.style, {
  backgroundColor: colore,
  width: `${size * 2}px`,
  height: `${size * 2}px`,
  fontSize: "12px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "5px",
  lineHeight: "1.2",
  wordBreak: "break-word",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
 });

 return div;
}

// Posizione iniziale casuale senza sovrapposizione
function trovaPosizioneLibera(cloud, size, esistenti, maxTentativi = 100) {
 let x,
  y,
  overlapping,
  tentativi = 0;
 do {
  x = Math.random() * (cloud.offsetWidth - size * 2);
  y = Math.random() * (cloud.offsetHeight - size * 2);
  overlapping = esistenti.some((b) => {
   const dx = b.x - x;
   const dy = b.y - y;
   const dist = Math.hypot(dx, dy);
   return dist < size * 2;
  });
  tentativi++;
 } while (overlapping && tentativi < maxTentativi);
 return { x, y };
}
