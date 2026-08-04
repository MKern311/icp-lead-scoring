import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize, parseGermanNumber, parseBooleanWord } from '../docs/js/core/csv.js';

test('parse: Semikolon-Delimiter wird erkannt (deutsches Excel)', () => {
  const r = parse('Name;Branche;Mitarbeiter\r\nMüller GmbH;SaaS;30\r\n');
  assert.equal(r.delimiter, ';');
  assert.deepEqual(r.header, ['Name', 'Branche', 'Mitarbeiter']);
  assert.deepEqual(r.rows, [['Müller GmbH', 'SaaS', '30']]);
  assert.deepEqual(r.errors, []);
});

test('parse: Komma-Delimiter wird erkannt', () => {
  const r = parse('name,industry\nAcme,SaaS\n');
  assert.equal(r.delimiter, ',');
  assert.deepEqual(r.rows, [['Acme', 'SaaS']]);
});

test('parse: bei Gleichstand gewinnt Semikolon', () => {
  const r = parse('a;b,c\nx;y,z\n');
  assert.equal(r.delimiter, ';');
});

test('parse: Anführungszeichen mit eingebetteten Delimitern, Umbrüchen und ""', () => {
  const text = 'Name;Notiz\n"Meier; Söhne";"Zeile 1\nZeile 2 mit ""Zitat"""\n';
  const r = parse(text);
  assert.deepEqual(r.rows, [['Meier; Söhne', 'Zeile 1\nZeile 2 mit "Zitat"']]);
  assert.deepEqual(r.errors, []);
});

test('parse: BOM wird toleriert, Unix- und Windows-Zeilenenden', () => {
  const r = parse('﻿Name;Wert\nA;1\r\nB;2\n');
  assert.deepEqual(r.header, ['Name', 'Wert']);
  assert.equal(r.rows.length, 2);
});

test('parse: leere Zeilen werden übersprungen, abweichende Spaltenzahl ist Zeilenfehler', () => {
  const r = parse('Name;Wert\nA;1\n\nB;1;extra\nC;3\n');
  assert.deepEqual(r.rows, [['A', '1'], ['C', '3']]);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].line, 4);
  assert.ok(r.errors[0].reason.includes('Spalten'));
});

test('parse: leere Datei liefert verständlichen Fehler', () => {
  const r = parse('');
  assert.equal(r.rows.length, 0);
  assert.ok(r.errors.length > 0);
});

test('serialize: BOM, Semikolon, CRLF, alle Felder gequotet, " als "" escaped', () => {
  const out = serialize(['Name', 'Notiz'], [['Müller "M." GmbH', 'a;b']]);
  assert.ok(out.startsWith('﻿'));
  assert.ok(out.includes('"Name";"Notiz"\r\n'));
  assert.ok(out.includes('"Müller ""M."" GmbH";"a;b"'));
  assert.ok(out.endsWith('\r\n'));
});

test('serialize → parse Roundtrip', () => {
  const rows = [['Fa. "X"', 'mit;Semikolon', 'mehr\nZeilen']];
  const r = parse(serialize(['a', 'b', 'c'], rows));
  assert.deepEqual(r.rows, rows);
});

test('parseGermanNumber: Komma und Punkt als Dezimaltrenner', () => {
  assert.equal(parseGermanNumber('12,5'), 12.5);
  assert.equal(parseGermanNumber('12.5'), 12.5);
  assert.equal(parseGermanNumber(' -3 '), -3);
  assert.equal(parseGermanNumber('1.234,5'), null); // Tausendertrenner nicht unterstützt
  assert.equal(parseGermanNumber('abc'), null);
  assert.equal(parseGermanNumber(''), null);
});

test('parseBooleanWord: deutsche und englische Synonyme', () => {
  for (const w of ['ja', 'Ja', 'YES', 'true', '1', 'x', 'X']) assert.equal(parseBooleanWord(w), true, w);
  for (const w of ['nein', 'No', 'FALSE', '0']) assert.equal(parseBooleanWord(w), false, w);
  assert.equal(parseBooleanWord('vielleicht'), null);
  assert.equal(parseBooleanWord(''), null);
});
