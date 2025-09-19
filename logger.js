// logger.js
const fs = require("fs");
const path = require("path");

const logFilePath = path.join(__dirname, "server.log");

function log(message) {
 const timestamp = new Date().toISOString();
 const fullMessage = `[${timestamp}] ${message}\n`;
 fs.appendFile(logFilePath, fullMessage, (err) => {
  if (err) console.error("Errore nel logging:", err);
 });
}

function scheduleMonthlyLogCleanup() {
 const now = new Date();
 const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
 const delay = firstOfNextMonth - now;

 setTimeout(() => {
  fs.unlink(logFilePath, (err) => {
   if (!err) {
    console.log("Log mensile cancellato.");
   }
  });
  scheduleMonthlyLogCleanup(); // Ri-programma per il mese successivo
 }, delay);
}

module.exports = { log, scheduleMonthlyLogCleanup };
