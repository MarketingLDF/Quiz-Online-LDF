# Quiz Online LDF - Applicazione Quiz in Tempo Reale

![Laboratorio della Farmacia](https://www.laboratoriodellafarmacia.it/build/images/logo/logo_laboratorio.3ef25cbe.svg)

## 📋 Descrizione

**Quiz Online LDF** è un'applicazione web interattiva per la gestione di quiz in tempo reale, sviluppata per il Laboratorio della Farmacia. L'applicazione permette di creare sessioni di quiz con partecipanti multipli, gestire domande con timer personalizzabile, tracciare punteggi e visualizzare classifiche in tempo reale.

## ✨ Caratteristiche Principali

### 🎯 Funzionalità Core
- **Sessioni Multi-Utente**: Creazione e gestione di sessioni di quiz con codici univoci
- **Quiz Personalizzabili**: Caricamento di quiz personalizzati in formato JSON
- **Timer Configurabile**: Durata personalizzabile per ogni domanda (10-300 secondi)
- **Punteggi in Tempo Reale**: Sistema di punteggio dinamico con classifica live
- **Interfaccia Responsive**: Design ottimizzato per desktop e dispositivi mobili

### 🎮 Modalità di Gioco
- **Presentatore**: Interfaccia per gestire la sessione, avviare domande e monitorare partecipanti
- **Partecipante**: Interfaccia semplificata per rispondere alle domande
- **Waiting Room**: Sala d'attesa per i partecipanti prima dell'inizio del quiz
- **Lobby**: Area di ingresso per inserire nome e codice sessione

### 🎨 Caratteristiche UX/UI
- **Animazioni Fluide**: Effetti visivi e transizioni animate
- **Feedback Audio**: Suoni per interazioni e notifiche
- **Confetti Effect**: Celebrazioni animate per risultati positivi
- **Design Moderno**: Interfaccia pulita con Bootstrap 5 e icone personalizzate

## 🛠️ Tecnologie Utilizzate

### Backend
- **Node.js**: Runtime JavaScript server-side
- **Express.js**: Framework web minimalista e flessibile
- **Socket.IO**: Comunicazione WebSocket in tempo reale
- **File System**: Gestione file JSON per quiz e logging

### Frontend
- **HTML5/CSS3**: Struttura e styling responsive
- **JavaScript ES6+**: Logica client-side moderna
- **Bootstrap 5**: Framework CSS per UI responsive
- **Bootstrap Icons**: Set di icone vettoriali
- **Canvas Confetti**: Libreria per effetti di celebrazione

### Dipendenze
```json
{
  "express": "^4.18.2",
  "socket.io": "^4.8.1",
  "nodemon": "^3.0.0"
}
```

## 📁 Struttura del Progetto

```
quiz_online/
├── 📄 server-quiz.js          # Server principale con logica WebSocket
├── 📄 logger.js               # Sistema di logging personalizzato
├── 📄 package.json            # Configurazione dipendenze Node.js
├── 📄 quiz.json               # Quiz di esempio
├── 📁 public/                 # File statici client-side
│   ├── 📄 lobby.html          # Pagina di ingresso
│   ├── 📄 waiting_room.html   # Sala d'attesa partecipanti
│   ├── 📄 presenter.html      # Interfaccia presentatore
│   ├── 📄 participant.html    # Interfaccia partecipante
│   ├── 📄 presenter.js        # Logica presentatore
│   ├── 📄 participant.js      # Logica partecipante
│   ├── 📄 waiting_room.js     # Logica sala d'attesa
│   ├── 📄 script_qr.js        # Utilità QR code
│   ├── 📄 utility_animazioni.js # Animazioni e effetti
│   ├── 📄 style.css           # Stili personalizzati
│   └── 📁 media/              # Risorse multimediali
│       ├── 🔊 *.wav           # File audio per feedback
│       └── 🖼️ favicon-32x32.png # Icona applicazione
├── 📁 quizzes/                # Repository quiz JSON
│   ├── 📄 animali-europei.json
│   └── 📄 quiz-farmacia-clinica.json
└── 📄 server.log              # File di log applicazione
```

## 🚀 Installazione e Configurazione

### Prerequisiti
- **Node.js** (versione 16 o superiore)
- **npm** (Node Package Manager)

### Installazione
```bash
# Clona il repository
git clone https://github.com/MarketingLDF/quiz-online-ldf.git
cd quiz-online-ldf

# Installa le dipendenze
npm install

# Avvia l'applicazione
npm start
```

### Modalità Sviluppo
```bash
# Avvia con auto-reload
npm run dev
```

## 🎯 Utilizzo

### 1. Avvio dell'Applicazione
- Avvia il server con `npm start`
- L'applicazione sarà disponibile su `http://localhost:4000/quiz`

### 2. Creazione Sessione (Presentatore)
1. Accedi a `/quiz/presenter.html`
2. Clicca il pulsante FAB (⚙️) per aprire le impostazioni
3. Seleziona un quiz dalla lista o carica un nuovo file JSON
4. Imposta la durata delle domande (default: 60 secondi)
5. Avvia la sessione e condividi il codice con i partecipanti

### 3. Partecipazione al Quiz
1. Accedi a `/quiz/lobby.html`
2. Inserisci nome e codice sessione
3. Attendi nella waiting room l'inizio del quiz
4. Rispondi alle domande entro il tempo limite

### 4. Gestione Quiz Personalizzati
I quiz devono essere in formato JSON con questa struttura:
```json
{
  "title": "Nome del Quiz",
  "questions": [
    {
      "question": "Testo della domanda",
      "a": "Opzione A",
      "b": "Opzione B", 
      "c": "Opzione C",
      "d": "Opzione D",
      "correct": ["a", "c"]
    }
  ]
}
```

## 🔧 Configurazione

### Porta del Server
Modifica la variabile `PORT` in `server-quiz.js`:
```javascript
const PORT = 4000; // Cambia secondo necessità
```

### Durata Timer
Il timer può essere configurato per sessione (10-300 secondi):
- Default: 60 secondi
- Configurabile dall'interfaccia presentatore
- Memorizzato per sessione

### Logging
- Log automatico delle attività in `server.log`
- Pulizia mensile automatica dei log
- Tracciamento connessioni, sessioni e errori

## 🎮 Funzionalità Avanzate

### Sistema di Punteggio
- Punteggio basato su correttezza e velocità di risposta
- Classifica in tempo reale
- Supporto per domande a risposta multipla

### Gestione Sessioni
- Codici sessione univoci generati automaticamente
- Gestione multipla di sessioni simultanee
- Controllo accessi e validazione partecipanti

### Interfaccia Multimediale
- Feedback audio per interazioni
- Animazioni fluide e responsive
- Effetti di celebrazione per risultati positivi

## 🔒 Sicurezza

- Validazione input lato server
- Gestione errori robusta
- Logging delle attività per audit
- Controllo accessi alle sessioni

## 🐛 Risoluzione Problemi

### Problemi Comuni

**Errore "Sessione già esistente"**
- Causa: Tentativo di creare una sessione con ID duplicato
- Soluzione: Riavvia l'applicazione o usa un nuovo codice

**Partecipanti non ricevono domande**
- Causa: Problemi di connessione WebSocket
- Soluzione: Verifica la connessione di rete e ricarica la pagina

**Quiz non si carica**
- Causa: Formato JSON non valido
- Soluzione: Valida la struttura del file JSON

### Debug
Abilita i log dettagliati controllando `server.log` per:
- Connessioni WebSocket
- Creazione/gestione sessioni
- Errori di caricamento quiz

## 🤝 Contribuire

1. Fork del repository
2. Crea un branch per la feature (`git checkout -b feature/nuova-funzionalita`)
3. Commit delle modifiche (`git commit -am 'Aggiunge nuova funzionalità'`)
4. Push del branch (`git push origin feature/nuova-funzionalita`)
5. Crea una Pull Request

## 📄 Licenza

Questo progetto è rilasciato sotto licenza ISC.

## 👨‍💻 Autore

**Dario Stevanato** - Laboratorio della Farmacia

## 📞 Supporto

Per supporto tecnico o domande:
- Apri una issue su GitHub
- Contatta il team di sviluppo

## 📈 Changelog

### v1.0.0 (Corrente)
- ✅ Implementazione sistema quiz in tempo reale
- ✅ Interfacce presentatore e partecipante
- ✅ Sistema di punteggio e classifiche
- ✅ Caricamento quiz personalizzati
- ✅ Timer configurabile per domande
- ✅ Logging automatico e pulizia mensile
- ✅ Design responsive con Bootstrap 5
- ✅ Effetti audio e animazioni

---

*Sviluppato con ❤️ per il Laboratorio della Farmacia*