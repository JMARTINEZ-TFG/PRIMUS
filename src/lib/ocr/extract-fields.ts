// Extracción de campos de un comprobante argentino (factura de servicio o resumen
// de tarjeta) a partir de su texto, ya sea el texto embebido de un PDF o el
// resultado del OCR. Es una función pura: no depende del navegador ni del servidor.
//
// Cada candidato (monto o fecha) recibe un puntaje según su cercanía a etiquetas
// como "Total a pagar" o "Vencimiento" y según cuántas veces se repite en el
// documento (el total y el vencimiento suelen figurar en el cuerpo y en el talón).

export type ExtractedFields = {
  emisor: string | null;
  monto: number | null;
  fecha_vencimiento: string | null; // YYYY-MM-DD
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Corrige confusiones típicas del OCR dentro de tokens numéricos:
// "s7.437.08" → "57.437,08", "Ol-Oct-26" → "01-Oct-26", "20-0ct-26" → "20-Oct-26".
function fixOcrNumbers(line: string): string {
  return line
    .replace(/(?<![A-Za-z])[\dOoSsIl|][\dOoSsIl|.,]*\d(?![A-Za-z])/g, (tok) => {
      const digits = (tok.match(/\d/g) ?? []).length;
      if (digits < 3) return tok;
      const fixed = tok.replace(/[Oo]/g, "0").replace(/[Ss]/g, "5").replace(/[Il|]/g, "1");
      // Decimal con punto cuando ya hay separador de miles con punto: 57.437.08 → 57.437,08
      return fixed.replace(/^(\d{1,3}(?:\.\d{3})+)\.(\d{2})$/, "$1,$2");
    })
    .replace(/\b([0-3O][0-9Ol])-(0ct|N0v|n0v)\b/g, (_, d: string, m: string) =>
      `${d.replace(/O/g, "0").replace(/l/g, "1")}-${m.replace(/0/g, "o")}`,
    )
    .replace(/\bOl-/g, "01-");
}

function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => fixOcrNumbers(l.replace(/\s+/g, " ").trim()))
    .filter(Boolean);
}

type Candidate<T> = { value: T; score: number };

function addScore<T>(map: Map<string, Candidate<T>>, key: string, value: T, delta: number) {
  const c = map.get(key);
  if (c) c.score += delta;
  else map.set(key, { value, score: delta });
}

// ─── Monto ───────────────────────────────────────────────────────────────────

// Formato argentino: 57.437,08 · 150040,00 · $ 75.571,60 (siempre con 2 decimales).
// Se descartan porcentajes ("21,00 %") y números que forman parte de otros más largos.
const AMOUNT_RE = /(?<![\d.,])(-?)(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?![\d,.])(?!\s?%)/g;

const TOTAL_LABEL_RE =
  /total\s+a\s+pagar|importe\s+a\s+pagar|monto\s+a\s+pagar|saldo\s+a\s+pagar|importe\s+total|total\s+factura/;
const AMOUNT_PENALTY_RE = /minimo|anterior|subtotal|neto|iva|impuesto|percepcion|bonif/;

// La etiqueta cuenta salvo que se refiera a otro período ("total a pagar del
// período anterior"); "anterior" en otra columna del mismo encabezado no la anula.
function hasLabel(line: string, label: RegExp, before = 0): boolean {
  const m = label.exec(line);
  if (!m) return false;
  const around = line.slice(Math.max(0, m.index - before), m.index + m[0].length + 30);
  return !/anterior|proximo/.test(around);
}

// Importe con "$" y separador de miles pero sin centavos legibles: "$ 139.732"
// (p. ej. centavos en superíndice que el OCR no lee). Se toma sin centavos.
const AMOUNT_NO_CENTS_RE = /\$\s?(\d{1,3}(?:\.\d{3})+)(?![\d,.])/g;

function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    if (m[1] === "-") continue;
    const value = Number(`${m[2].replace(/\./g, "")}.${m[3]}`);
    if (value > 0) out.push(value);
  }
  for (const m of line.matchAll(AMOUNT_NO_CENTS_RE)) {
    const value = Number(m[1].replace(/\./g, ""));
    if (value > 0) out.push(value);
  }
  return out;
}

function extractAmount(lines: string[]): number | null {
  const norm = lines.map(normalize);
  const cands = new Map<string, Candidate<number>>();

  norm.forEach((line, i) => {
    for (const v of amountsIn(lines[i])) addScore(cands, v.toFixed(2), v, 1);

    const isLabel = hasLabel(line, TOTAL_LABEL_RE);
    if (isLabel) {
      // Valores en la misma línea o en las 2 siguientes (tablas con encabezado arriba)
      [0, 1, 2].forEach((offset) => {
        const j = i + offset;
        if (j >= lines.length) return;
        for (const v of amountsIn(lines[j])) addScore(cands, v.toFixed(2), v, offset === 0 ? 4 : 3);
      });
    }
    if (AMOUNT_PENALTY_RE.test(line) && !isLabel) {
      [0, 1].forEach((offset) => {
        const j = i + offset;
        if (j >= lines.length) return;
        for (const v of amountsIn(lines[j])) addScore(cands, v.toFixed(2), v, -2);
      });
    }
  });

  const best = [...cands.values()].sort((a, b) => b.score - a.score || b.value - a.value)[0];
  return best && best.score > 0 ? best.value : null;
}

// ─── Fecha de vencimiento ────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

const NUMERIC_DATE_RE = /(?<![\d/.-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/.-])/g;
const ABBR_DATE_RE = /(?<!\d)(\d{1,2})[-/ ]([a-z]{3})[a-z]*\.?[-/ ](\d{4}|\d{2})(?!\d)/g;
const LONG_DATE_RE = /(?<!\d)(\d{1,2}) de ([a-z]+)(?: (?:de |del )?(\d{4}))?/g;

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y);
}

// Año de una fecha: sin año ("23 de octubre") → año corriente. Un año a 2 o 3
// años del actual se considera un dígito mal leído por el OCR (p. ej. 2028 por
// 2026) → año corriente. Los años más lejanos (inicio de actividades, 1993) se
// dejan como están y quedan fuera del rango de candidatos.
function resolveYear(year: number | null, today: Date): number {
  const current = today.getFullYear();
  if (year === null) return current;
  const diff = Math.abs(year - current);
  return diff === 2 || diff === 3 ? current : year;
}

function datesIn(normLine: string, today: Date): string[] {
  const out: string[] = [];
  for (const m of normLine.matchAll(NUMERIC_DATE_RE)) {
    const d = iso(resolveYear(fullYear(m[3]), today), Number(m[2]), Number(m[1]));
    if (d) out.push(d);
  }
  for (const m of normLine.matchAll(ABBR_DATE_RE)) {
    const month = MONTHS[m[2]];
    const d = month ? iso(resolveYear(fullYear(m[3]), today), month, Number(m[1])) : null;
    if (d) out.push(d);
  }
  for (const m of normLine.matchAll(LONG_DATE_RE)) {
    const month = MONTHS[m[2].slice(0, 3)];
    if (!month) continue;
    const d = iso(resolveYear(m[3] ? Number(m[3]) : null, today), month, Number(m[1]));
    if (d) out.push(d);
  }
  return out;
}

// "Vencimiento", "Vto", "Vence" — excepto el vencimiento del CAE (AFIP) o del
// CESP (servicios públicos), los del período anterior/próximo y "facturas
// vencidas" o "cuotas a vencer".
const DUE_LABEL_RE = /\b(vencimiento|vto|vence)\b/;
const CAE_RE = /\bc\.?\s?a\.?\s?e\b|\bc\.?\s?e\.?\s?s\.?\s?p\b/;
const DATE_PENALTY_RE = /cierre|emision|inicio de actividades|fecha:|periodo/;

const DAY_MS = 24 * 60 * 60 * 1000;

// Resúmenes de tarjeta (Visa/Mastercard de Prisma): "ciclo de facturación" con
// fechas tipo 27-Ago-26 → cierre ant. · vto. ant. · cierre actual · VTO. ACTUAL ·
// próx. cierre · próx. vto. Se juntan las fechas de todas las filas del ciclo (el
// OCR puede haber leído cada una en una pasada distinta) y se arman los pares
// cierre → vencimiento (5 a 16 días después). El vencimiento actual es el del
// segundo par. Funciona aunque falte alguna fecha del ciclo.
function billingCycleDueDate(normLines: string[], today: Date): string | null {
  const set = new Set<string>();
  for (const line of normLines) {
    const found: string[] = [];
    for (const m of line.matchAll(ABBR_DATE_RE)) {
      const month = MONTHS[m[2]];
      const d = month ? iso(resolveYear(fullYear(m[3]), today), month, Number(m[1])) : null;
      if (d) found.push(d);
    }
    if (found.length >= 4) found.forEach((d) => set.add(d));
  }
  const dates = [...set].sort();
  if (dates.length < 4) return null;

  const dues: string[] = [];
  let openClose: string | null = null;
  for (const d of dates) {
    const gap = openClose ? (Date.parse(d) - Date.parse(openClose)) / DAY_MS : -1;
    if (openClose && gap >= 5 && gap <= 16) {
      dues.push(d);
      openClose = null;
    } else {
      openClose = d;
    }
  }
  return dues.length >= 2 ? dues[1] : null;
}

function extractDueDate(lines: string[], today: Date): string | null {
  const norm = lines.map(normalize);
  const dates = norm.map((l) => datesIn(l, today));
  const cands = new Map<string, Candidate<string>>();

  const minDate = new Date(today.getFullYear() - 2, 0, 1).toISOString().slice(0, 10);
  const maxDate = new Date(today.getFullYear() + 2, 11, 31).toISOString().slice(0, 10);
  const inRange = (d: string) => d >= minDate && d <= maxDate;

  norm.forEach((line, i) => {
    for (const d of dates[i]) {
      if (!inRange(d)) continue;
      addScore(cands, d, d, 1);
      // Fecha en la línea del CAE/CESP: es el vencimiento del código, no del pago
      if (CAE_RE.test(line)) addScore(cands, d, d, -10);
    }

    if (hasLabel(line, DUE_LABEL_RE, 12) && !CAE_RE.test(line)) {
      [4, 3, 2].forEach((bonus, offset) => {
        const j = i + offset;
        if (j >= lines.length) return;
        for (const d of dates[j]) if (inRange(d)) addScore(cands, d, d, bonus);
      });
    }

    if (DATE_PENALTY_RE.test(line)) {
      [0, 1].forEach((offset) => {
        const j = i + offset;
        if (j >= lines.length) return;
        for (const d of dates[j]) if (inRange(d)) addScore(cands, d, d, -2);
      });
    }

  });

  const cycleDue = billingCycleDueDate(norm, today);
  if (cycleDue) addScore(cands, cycleDue, cycleDue, 6);

  // A igual puntaje se toma el vencimiento más próximo (primer vencimiento)
  const best = [...cands.values()].sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))[0];
  return best && best.score > 1 ? best.value : null;
}

// ─── Emisor ──────────────────────────────────────────────────────────────────

const KNOWN_ISSUERS: [RegExp, string][] = [
  [/empresa provincial de energia de cordoba|\bepec\b/, "EPEC"],
  [/ecogas|distribuidora de gas del centro|distribuidora de gas cuyana/, "Ecogas"],
  [/aguas cordobesas/, "Aguas Cordobesas"],
  [/\badt security|\badt\b/, "ADT"],
  [/\bedenor\b/, "Edenor"],
  [/\bedesur\b/, "Edesur"],
  [/\bmetrogas\b/, "Metrogas"],
  [/\bnaturgy\b/, "Naturgy"],
  [/\baysa\b|agua y saneamientos argentinos/, "AySA"],
  [/\bepe\b|empresa provincial de energia de santa fe/, "EPE Santa Fe"],
  [/\bpersonal\b.*\btelecom\b|\btelecom argentina\b/, "Telecom"],
  [/\bfibertel\b/, "Fibertel"],
  [/\btelecentro\b/, "Telecentro"],
  [/\bmovistar\b|telefonica moviles/, "Movistar"],
  [/\bclaro\b|amx argentina/, "Claro"],
  [/\bdirectv\b/, "DirecTV"],
  [/\bcablevision\b|\bflow\b/, "Flow"],
];

const CARD_NETWORKS: [RegExp, string][] = [
  [/\bvisa\b/, "Visa"],
  [/\bmastercard\b|\bmaster card\b/, "Mastercard"],
  [/american express|\bamex\b/, "American Express"],
  [/\bcabal\b/, "Cabal"],
];

// CUIT del banco emisor (figura en el encabezado del resumen)
const BANK_CUITS: Record<string, string> = {
  "30-50000173-5": "Galicia",
};

const BANK_NAMES: [RegExp, string][] = [
  [/mercado pago|mercadopago/, "Mercado Pago"],
  [/naranja x|tarjeta naranja/, "Naranja X"],
  [/\buala\b/, "Ualá"],
  [/banco de galicia|\bgalicia\b/, "Galicia"],
  [/santander/, "Santander"],
  [/\bbbva\b/, "BBVA"],
  [/banco macro|\bmacro\b/, "Macro"],
  [/banco de la nacion|\bbna\b/, "Nación"],
  [/banco provincia|bapro/, "Provincia"],
  [/banco ciudad|ciudad de buenos aires/, "Ciudad"],
  [/patagonia/, "Patagonia"],
  [/supervielle/, "Supervielle"],
  [/\bicbc\b/, "ICBC"],
  [/credicoop/, "Credicoop"],
  [/bancor|provincia de cordoba/, "Bancor"],
  [/brubank/, "Brubank"],
];

function extractIssuer(lines: string[]): string | null {
  const norm = lines.map(normalize);
  const head = norm.slice(0, 12).join("\n");
  const all = norm.join("\n");

  // Resumen de tarjeta: red (Visa, Mastercard…) + banco emisor
  if (/resumen|tarjeta de credito|tarjeta credito/.test(head)) {
    const network = CARD_NETWORKS.find(([re]) => re.test(head))?.[1] ?? null;
    const cuit = Object.keys(BANK_CUITS).find((c) => all.includes(c));
    const bank = cuit
      ? BANK_CUITS[cuit]
      : BANK_NAMES.find(([re]) => re.test(head))?.[1] ?? BANK_NAMES.find(([re]) => re.test(all))?.[1] ?? null;
    if (network && bank) return `${network} ${bank}`;
    if (bank) return `Tarjeta ${bank}`;
    if (network) return network;
  }

  for (const [re, name] of KNOWN_ISSUERS) if (re.test(all)) return name;

  // Último recurso: primera razón social (S.A., S.R.L., …) del encabezado
  const company = lines
    .slice(0, 15)
    .find((l) => /\b(s\.?\s?a\.?\s?u?\.?|s\.?\s?r\.?\s?l\.?)$/i.test(l.trim()));
  if (company) {
    return company.replace(/^(factura|liquidacion|recibo)\s+/i, "").trim() || null;
  }
  return null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

// Indica si conviene una segunda pasada de OCR con la imagen invertida, que lee el
// texto claro sobre fondos de color (p. ej. el vencimiento resaltado en los
// resúmenes de tarjeta): cuando falta algún campo o el documento es un resumen.
export function needsInvertedPass(text: string): boolean {
  const f = extractFields(text);
  if (!f.emisor || !f.monto || !f.fecha_vencimiento) return true;
  const head = toLines(text).slice(0, 12).map(normalize).join("\n");
  return /resumen|tarjeta de credito|tarjeta credito/.test(head);
}

export function extractFields(text: string, today: Date = new Date()): ExtractedFields {
  const lines = toLines(text);
  return {
    emisor: extractIssuer(lines),
    monto: extractAmount(lines),
    fecha_vencimiento: extractDueDate(lines, today),
  };
}
