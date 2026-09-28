#!/usr/bin/env node
/**
 * Aggiorna la sezione "Consigli della Settimana" di index.html
 * pescando dal set di rotazione in data/consigli-rotation.json.
 *
 * Selezione deterministica basata sulla settimana ISO dell'anno,
 * cosi' la rotazione avanza automaticamente ogni settimana senza
 * bisogno di stato salvato altrove. Nessuna dipendenza esterna,
 * nessuna chiamata di rete: puo' fallire solo se i file mancano
 * o sono malformati.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const ROTATION_PATH = path.join(ROOT, 'data', 'consigli-rotation.json');

const START_MARKER = '<!-- WEEKLY-TIPS-START -->';
const END_MARKER = '<!-- WEEKLY-TIPS-END -->';

const MESI_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

function getIsoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday) {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const dStart = monday.getDate();
  const dEnd = sunday.getDate();
  const mStart = MESI_IT[monday.getMonth()];
  const mEnd = MESI_IT[sunday.getMonth()];
  const yStart = monday.getFullYear();
  const yEnd = sunday.getFullYear();

  if (monday.getMonth() === sunday.getMonth() && yStart === yEnd) {
    return `${dStart}–${dEnd} ${mStart} ${yStart}`;
  }
  if (yStart === yEnd) {
    return `${dStart} ${mStart} – ${dEnd} ${mEnd} ${yStart}`;
  }
  return `${dStart} ${mStart} ${yStart} – ${dEnd} ${mEnd} ${yEnd}`;
}

function buildCardsHtml(cards, weekLabel) {
  const cardsHtml = cards.map(c => `  <div class="consiglio-card">
    <span class="consiglio-emoji">${c.emoji}</span>
    <h3>${c.title}</h3>
    <p>${c.text}</p>
    <span class="consiglio-week">${weekLabel}</span>
  </div>`).join('\n');

  return `<div class="consigli-grid">\n${cardsHtml}\n</div>`;
}

function main() {
  const rotation = JSON.parse(fs.readFileSync(ROTATION_PATH, 'utf8'));
  if (!Array.isArray(rotation) || rotation.length === 0) {
    throw new Error('consigli-rotation.json vuoto o malformato');
  }

  const now = new Date();
  const monday = getMondayOfWeek(now);
  const weekNumber = getIsoWeekNumber(monday);

  // Ancoraggio calendario: l'indice 0 dell'array corrisponde alla settimana
  // ISO 40 del 2026 (28 set - 4 ott, "Autunno: proteggi le vie respiratorie").
  // Cosi' la rotazione parte sempre dal contenuto giusto per la stagione in
  // corso, invece di ripartire da zero ogni inizio anno. Dato che l'array ha
  // meno voci di 52 settimane, dopo un giro completo (circa ogni N settimane,
  // N = rotation.length) il ciclo ricomincia: e' un limite noto, accettabile
  // per un elenco di consigli stagionali generici. Se si vuole evitare
  // ripetizioni fuori stagione, aggiungere piu' voci in consigli-rotation.json.
  const ANCHOR_ISO_WEEK = 40;
  const ANCHOR_ISO_YEAR = 2026;

  const absoluteWeek = (monday.getFullYear() - ANCHOR_ISO_YEAR) * 52 + (weekNumber - ANCHOR_ISO_WEEK);
  const index = ((absoluteWeek % rotation.length) + rotation.length) % rotation.length;
  const cards = rotation[index];

  if (!Array.isArray(cards) || cards.length !== 3) {
    throw new Error(`Set di rotazione all'indice ${index} non valido (attese 3 card)`);
  }

  const weekLabel = formatWeekLabel(monday);
  const newBlock = buildCardsHtml(cards, weekLabel);

  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error('Marker WEEKLY-TIPS-START/END non trovati o in ordine errato in index.html');
  }

  const before = html.slice(0, startIdx + START_MARKER.length);
  const after = html.slice(endIdx);

  const updatedHtml = `${before}\n${newBlock}\n${after}`;

  if (updatedHtml === html) {
    console.log('Nessuna modifica: il contenuto e\' gia\' aggiornato.');
    process.exit(0);
  }

  fs.writeFileSync(INDEX_PATH, updatedHtml, 'utf8');
  console.log(`Consigli aggiornati: settimana ISO ${weekNumber}, set #${index + 1}/${rotation.length}, periodo "${weekLabel}".`);
}

main();
