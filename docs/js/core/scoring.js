// Scoring-Engine — pure Funktion, Regeln fixiert in contracts/scoring-engine.md.
// Identische Eingaben liefern überall identische Ergebnisse (Constitution II).

export const round1 = (x) => Math.round(x * 10) / 10;

const hasRawValue = (v) => v !== undefined && v !== null && v !== '';

// Punkte je Kriterientyp (0–100) oder invalid-Kennzeichnung.
function criterionPoints(criterion, value) {
  const r = criterion.rules || {};
  switch (criterion.type) {
    case 'select': {
      const opt = (r.options || []).find((o) => o.id === value);
      return opt ? { points: opt.points } : { invalid: true };
    }
    case 'range': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { invalid: true };
      const hit = (r.ranges || []).find((rg) => value >= rg.min && value <= rg.max);
      return hit ? { points: hit.points } : { points: 0, outOfRange: true };
    }
    case 'boolean': {
      if (value === true) return { points: r.pointsYes };
      if (value === false) return { points: r.pointsNo };
      return { invalid: true };
    }
    case 'scale': {
      if (!Number.isFinite(value) || value < r.min || value > r.max) return { invalid: true };
      return { points: ((value - r.min) / (r.max - r.min)) * 100 };
    }
    default:
      return { invalid: true };
  }
}

export function evaluate(profile, lead) {
  const policy = profile.missingValuePolicy === 'zero' ? 'zero' : 'neutral';
  const values = lead.values || {};

  let knockoutMissing = false;
  let knockoutViolatedAny = false;
  const missing = [];

  // Pass 1: Rohpunkte und Einbeziehung je Kriterium bestimmen.
  const partial = profile.criteria.map((c) => {
    const rawValue = hasRawValue(values[c.id]) ? values[c.id] : null;
    const entry = {
      criterionId: c.id,
      rawValue,
      points: null,
      normalizedWeight: 0,
      contribution: 0,
      included: false,
    };

    let valueMissing = rawValue === null;
    if (!valueMissing) {
      const res = criterionPoints(c, rawValue);
      if (res.invalid) {
        entry.invalidValue = true;
        valueMissing = true;
      } else {
        entry.points = res.points;
        if (res.outOfRange) entry.outOfRange = true;
        entry.included = true;
      }
    }

    if (valueMissing) {
      missing.push(c.id);
      if (c.knockout) knockoutMissing = true; // K.o. ohne Wert ⇒ nicht bewertbar
      if (policy === 'zero') {
        entry.points = 0;
        entry.included = true;
      }
    } else if (c.knockout && entry.points < 1) {
      entry.knockoutViolated = true;
      knockoutViolatedAny = true;
    }

    return { entry, weight: c.weight };
  });

  // Pass 2: Gewichte über die einbezogenen Kriterien normieren.
  const includedWeight = partial.reduce((acc, x) => acc + (x.entry.included ? x.weight : 0), 0);
  let totalRaw = null;
  if (includedWeight > 0) {
    totalRaw = 0;
    for (const { entry, weight } of partial) {
      if (!entry.included) continue;
      entry.normalizedWeight = weight / includedWeight;
      entry.contribution = entry.normalizedWeight * entry.points;
      totalRaw += entry.contribution;
    }
  }

  const breakdown = partial.map((x) => x.entry);
  const complete = missing.length === 0;

  if (knockoutMissing || totalRaw === null) {
    return { status: 'not-evaluable', total: null, tierId: null, complete, missing, breakdown };
  }

  const total = round1(totalRaw);

  if (knockoutViolatedAny) {
    // Score wird informativ mitgeliefert, aber keine Stufe zugeordnet.
    return { status: 'disqualified', total, tierId: null, complete, missing, breakdown };
  }

  const tier = [...profile.tiers]
    .sort((a, b) => b.minScore - a.minScore)
    .find((t) => t.minScore <= total);

  return { status: 'scored', total, tierId: tier ? tier.id : null, complete, missing, breakdown };
}

export function evaluateAll(profile, leads) {
  return leads.map((lead) => evaluate(profile, lead));
}

// --- Erreichbare Punktzahl (Feature 008) ---
// Die Engine normiert die Gewichte, deshalb sind 100 Punkte nur dann erreichbar,
// wenn jedes Kriterium eine 100-Punkte-Ausprägung hat. Die Spanne folgt allein aus
// den Punktregeln — ohne Lead-Daten —, damit beim Definieren von Punkten und
// Stufenschwellen sichtbar ist, was am Ende überhaupt herauskommen kann.

// Punktspanne eines einzelnen Kriteriums oder null, wenn die Regeln unbrauchbar sind.
export function criterionPointRange(criterion) {
  const rules = criterion?.rules || {};
  const finite = (list) => list.map(Number).filter((n) => Number.isFinite(n));
  switch (criterion?.type) {
    case 'select': {
      const pts = finite((rules.options || []).map((o) => o.points));
      return pts.length > 0 ? { min: Math.min(...pts), max: Math.max(...pts) } : null;
    }
    case 'range': {
      const pts = finite((rules.ranges || []).map((r) => r.points));
      // Werte außerhalb aller Bereiche zählen 0 Punkte (Regel 1) — die 0 gehört zur Spanne.
      return pts.length > 0 ? { min: Math.min(0, ...pts), max: Math.max(...pts) } : null;
    }
    case 'boolean': {
      const pts = finite([rules.pointsYes, rules.pointsNo]);
      return pts.length === 2 ? { min: Math.min(...pts), max: Math.max(...pts) } : null;
    }
    case 'scale':
      return { min: 0, max: 100 };
    default:
      return null;
  }
}

// Spanne des Gesamtscores für einen Lead mit vollständigen Werten — dieselbe
// Gewichtsnormierung wie in `evaluate`. null, wenn nichts bewertbar ist.
export function scoreRange(profile) {
  const parts = (profile?.criteria || [])
    .map((c) => ({ weight: Number(c.weight) || 0, range: criterionPointRange(c) }))
    .filter((p) => p.range !== null && p.weight > 0);
  const totalWeight = parts.reduce((acc, p) => acc + p.weight, 0);
  if (totalWeight <= 0) return null;

  let min = 0;
  let max = 0;
  for (const { weight, range } of parts) {
    min += (weight / totalWeight) * range.min;
    max += (weight / totalWeight) * range.max;
  }
  return { min: round1(min), max: round1(max) };
}

// Stufen, deren Schwelle über der Höchstpunktzahl liegt — sie könnte niemand erreichen.
export function unreachableTiers(profile) {
  const range = scoreRange(profile);
  if (!range) return [];
  return (profile?.tiers || []).filter((t) => Number(t.minScore) > range.max);
}
