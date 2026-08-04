// CSV-Parser/-Serializer — RFC-4180-Subset, Regeln in contracts/csv-format.md.

// Delimiter aus der ersten logischen Zeile: Zeichen mit den meisten Vorkommen
// außerhalb von Anführungszeichen; bei Gleichstand ';' (deutsches Excel).
function detectDelimiter(text) {
  let semis = 0;
  let commas = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++;
        else inQuotes = false;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ';') {
      semis++;
    } else if (ch === ',') {
      commas++;
    } else if (ch === '\n' || ch === '\r') {
      break;
    }
  }
  return commas > semis ? ',' : ';';
}

export function parse(text) {
  if (typeof text === 'string' && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  if (!text || !text.trim()) {
    return { header: [], rows: [], errors: [{ line: 1, reason: 'Die Datei ist leer.' }], delimiter: ';' };
  }

  const delimiter = detectDelimiter(text);
  const records = [];
  let fields = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const pushField = () => { fields.push(field); field = ''; };
  const pushRecord = () => {
    pushField();
    records.push({ line: recordLine, fields });
    fields = [];
    recordLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      line++;
      pushRecord();
    } else if (ch === '\n') {
      line++;
      pushRecord();
    } else {
      field += ch;
    }
  }
  if (field !== '' || fields.length > 0) pushRecord();

  // Leere Zeilen entfernen (einzelnes leeres Feld).
  const nonEmpty = records.filter((r) => !(r.fields.length === 1 && r.fields[0].trim() === ''));
  if (nonEmpty.length === 0) {
    return { header: [], rows: [], errors: [{ line: 1, reason: 'Die Datei enthält keine Daten.' }], delimiter };
  }

  const header = nonEmpty[0].fields.map((h) => h.trim());
  const rows = [];
  const errors = [];
  for (const rec of nonEmpty.slice(1)) {
    if (rec.fields.length !== header.length) {
      errors.push({ line: rec.line, reason: `Erwartet ${header.length} Spalten, gefunden ${rec.fields.length}.` });
    } else {
      rows.push(rec.fields);
    }
  }
  return { header, rows, errors, delimiter };
}

// Export: UTF-8-BOM, ';'-Delimiter, CRLF, alle Felder gequotet (Excel DE).
export function serialize(header, rows) {
  const quote = (f) => `"${String(f ?? '').replaceAll('"', '""')}"`;
  const lines = [header, ...rows].map((r) => r.map(quote).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

// "12,5" → 12.5 — Komma oder Punkt als Dezimaltrenner, keine Tausendertrenner.
export function parseGermanNumber(str) {
  const s = String(str ?? '').trim();
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return null;
  return Number(s.replace(',', '.'));
}

const TRUE_WORDS = new Set(['ja', 'yes', 'true', '1', 'x']);
const FALSE_WORDS = new Set(['nein', 'no', 'false', '0']);

export function parseBooleanWord(str) {
  const s = String(str ?? '').trim().toLowerCase();
  if (TRUE_WORDS.has(s)) return true;
  if (FALSE_WORDS.has(s)) return false;
  return null;
}
