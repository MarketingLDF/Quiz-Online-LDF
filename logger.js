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

// Massimo delay gestibile da setTimeout (intero a 32 bit con segno)
const MAX_TIMEOUT = 2147483647; // ~24,8 giorni

function scheduleMonthlyLogCleanup() {
 const now = new Date();
 const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
 const delay = firstOfNextMonth - now;

 // setTimeout va in overflow oltre ~24,8 giorni (e scatterebbe immediatamente):
 // se manca più di così al primo del mese, attendo a tappe e ri-pianifico.
 if (delay > MAX_TIMEOUT) {
  setTimeout(scheduleMonthlyLogCleanup, MAX_TIMEOUT);
  return;
 }

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
