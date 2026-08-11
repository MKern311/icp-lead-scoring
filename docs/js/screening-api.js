// Netzwerkschicht für das Screening — bewusst dünn (contracts/screening.md).
// Der API-Schlüssel verlässt das Gerät ausschließlich im x-api-key-Header an api.anthropic.com.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_CONTINUATIONS = 6;

function mapHttpError(status, detail) {
  if (status === 401) return 'API-Schlüssel ungültig oder abgelaufen — bitte in den Einstellungen prüfen.';
  if (status === 400) return `Anfrage vom Dienst abgelehnt (ungültig)${detail ? `: ${detail}` : '.'}`;
  if (status === 429) return 'Rate-Limit erreicht — bitte in einigen Minuten erneut versuchen.';
  if (status === 529 || status >= 500) return 'Der Dienst ist momentan überlastet — bitte später erneut versuchen.';
  return `Unerwarteter Fehler vom Dienst (HTTP ${status}).`;
}

async function errorDetail(res) {
  try {
    const body = await res.json();
    return body?.error?.message || '';
  } catch {
    return '';
  }
}

// Führt den Lauf aus; behandelt pause_turn (Server-Tool-Iterationslimit) durch
// Fortsetzungs-Requests. Optionales AbortSignal (Feature 004: Tiefen-Screening
// abbrechbar). Liefert { output, usage } oder wirft mit deutscher Meldung.
export async function runScreening(apiKey, requestBody, onStatus = () => {}, { signal } = {}) {
  let messages = [...requestBody.messages];

  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    onStatus(attempt === 0
      ? 'Recherche läuft — das kann einige Minuten dauern …'
      : `Recherche läuft — Fortsetzung ${attempt} …`);

    let res;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ ...requestBody, messages }),
        signal,
      });
    } catch (e) {
      if (e?.name === 'AbortError') {
        const err = new Error('Recherche abgebrochen.');
        err.aborted = true;
        throw err;
      }
      throw new Error('Keine Verbindung zum Dienst — bitte Internetverbindung prüfen.');
    }

    if (!res.ok) throw new Error(mapHttpError(res.status, await errorDetail(res)));

    const data = await res.json();

    if (data.stop_reason === 'refusal') {
      throw new Error('Die Anfrage wurde vom Dienst abgelehnt. Bitte Kriterien oder Hinweise anpassen.');
    }
    if (data.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: data.content }];
      continue;
    }

    const textBlock = [...(data.content || [])].reverse().find((b) => b.type === 'text' && b.text);
    if (!textBlock) throw new Error('Der Dienst lieferte keine auswertbare Antwort.');
    try {
      return { output: JSON.parse(textBlock.text), usage: data.usage || null };
    } catch {
      throw new Error('Die Antwort konnte nicht als JSON gelesen werden — bitte erneut versuchen.');
    }
  }

  throw new Error('Die Recherche blieb nach mehreren Fortsetzungen unvollständig — bitte mit weniger Kandidaten erneut versuchen.');
}
