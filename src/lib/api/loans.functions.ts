import { createServerFn } from "@tanstack/react-start";
import { PESOS_PRODUCTS, type LoanProduct, type TipoEntidad } from "./loans-data";

// ─── BCRA — Régimen de Transparencia: Préstamos Personales ───────────────────
// API oficial: https://api.bcra.gob.ar/transparencia/v1.0/Prestamos/Personales
// Cada entidad informa sus productos con su propia fecha (fechaInformacion).
// Se publican todas las ofertas de libre destino en pesos y UVA de bancos y
// compañías financieras (se excluyen mutuales, cooperativas y otras entidades
// no bancarias).

const BCRA_URL = "https://api.bcra.gob.ar/transparencia/v1.0/Prestamos/Personales";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
// Solo ofertas informadas recientemente: las más viejas pueden no estar vigentes
const MAX_AGE_DAYS = 90;

type BcraPrestamo = {
  codigoEntidad: number;
  descripcionEntidad: string;
  fechaInformacion: string;
  nombreCompleto: string | null;
  nombreCorto: string | null;
  denominacion: string | null;
  beneficiario: string | null;
  montoMinimoOtorgable: number;
  montoMaximoOtorgable: number;
  plazoMaximoOtorgable: number;
  tasaEfectivaAnualMaxima: number;
  costoFinancieroEfectivoTotalMaximo: number;
};

// No se consideran préstamos personales de libre destino:
//  - destino específico (vehículos, vivienda, bienes, servicios, turismo, …)
//  - refinanciaciones de deudas existentes
//  - adelantos de sueldo y productos para personas jurídicas (empresas)
const DESTINO_ESPECIFICO_RE = new RegExp(
  [
    "PRENDA", "AUTOMOTOR", "\\bAUTOS?\\b", "\\bMOTOS?\\b", "VEHIC", "\\b0 ?KM\\b", "BICICLET", "MONOPATIN",
    "PLAN DE AHORRO", "VIVIEND", "\\bVVDA", "CONSTRUCC", "HIPOTEC", "TERRENO", "ALQUILER",
    "ELECTRO", "COMPRA", "ARTICULO", "HOGAR", "MUEBLE", "PROVEEDUR", "EQUIPAMIENT", "PANEL", "SOLAR",
    "CONEXION", "MICROCRED", "ESTUDI", "EDUCA", "SALUD", "TURIS", "VIAJE", "VACACION",
    "REFINANC", "REPROGRAM", "CONSOLIDAC", "REGULARIZ", "\\bDEUDAS?\\b",
    "ADELANTO", "ANTICIPO", "JURIDIC", "CHEQUE", "CUENTA CORRIENTE",
  ].join("|"),
);

// Algunas entidades informan como "Pesos" productos que ajustan por UVA
const UVA_RE = /\bUVA\b/;

// Nombres comerciales de las entidades más conocidas (por código BCRA)
const DISPLAY_NAMES: Record<number, string> = {
  7: "Banco Galicia",
  11: "Banco Nación",
  14: "Banco Provincia",
  17: "BBVA",
  20: "Bancor",
  27: "Banco Supervielle",
  29: "Banco Ciudad",
  34: "Banco Patagonia",
  44: "Banco Hipotecario",
  72: "Santander",
  143: "Brubank",
  191: "Banco Credicoop",
  285: "Banco Macro",
  384: "Ualá",
  45030: "Naranja X",
  72634: "Mercado Pago",
};

const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en", "para"]);

// "BANCO DE LA PAMPA SA" → "Banco de la Pampa"
function displayName(code: number, raw: string): string {
  if (DISPLAY_NAMES[code]) return DISPLAY_NAMES[code];
  const cleaned = raw
    .replace(/\s+(S\.?\s?A\.?\s?U?\.?|S\.?\s?R\.?\s?L\.?|SOCIEDAD AN[OÓ]NIMA( UNIPERSONAL)?|S\.?\s?A\.?\s?C\.?\s?I\.?.*)$/i, "")
    .trim();
  if (cleaned !== cleaned.toUpperCase()) return cleaned; // ya viene con mayúsculas y minúsculas
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && LOWERCASE_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function tipoEntidad(code: number, raw: string): TipoEntidad {
  if (code < 1000) return "Banco";
  if ((code >= 44000 && code < 46000) || /COMPA[ÑN][IÍ]A FINANCIERA/i.test(raw)) return "Compañía financiera";
  if (/MUTUAL|COOPERATIV|ASOCIACI[OÓ]N/i.test(raw)) return "Mutual / cooperativa";
  return "Otra entidad no bancaria";
}

const TIPOS_INCLUIDOS = new Set<TipoEntidad>(["Banco", "Compañía financiera"]);

// El BCRA publica el logo de cada entidad según su código (el mismo que usa en
// la información de plazos fijos)
function bcraLogo(code: number): string {
  return `https://www.bcra.gob.ar/archivos/Imagenes/logosbancos/${String(code).padStart(5, "0")}.png`;
}

function teaToTna(tea: number): number {
  if (tea <= 0) return 0;
  return Math.round(12 * (Math.pow(1 + tea / 100, 1 / 12) - 1) * 1000) / 10;
}

function toLoanProducts(rows: BcraPrestamo[], today: Date): LoanProduct[] {
  const minDate = new Date(today.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Se deduplica por entidad + producto + perfil + moneda, conservando la fila de
  // menor CFT (las demás son tramos o provincias del mismo producto)
  const best = new Map<string, BcraPrestamo>();
  for (const r of rows) {
    if (r.denominacion !== "Pesos" && r.denominacion !== "UVA") continue;
    if (!TIPOS_INCLUIDOS.has(tipoEntidad(r.codigoEntidad, r.descripcionEntidad))) continue;
    if (!(r.tasaEfectivaAnualMaxima > 0) || !(r.costoFinancieroEfectivoTotalMaximo > 0)) continue;
    if (!r.fechaInformacion || r.fechaInformacion < minDate) continue;
    const nombre = `${r.nombreCompleto ?? ""} ${r.nombreCorto ?? ""}`.toUpperCase();
    if (DESTINO_ESPECIFICO_RE.test(nombre)) continue;
    const tipo = r.denominacion === "UVA" || UVA_RE.test(nombre) ? "uva" : "pesos";

    const key = [r.codigoEntidad, (r.nombreCorto ?? r.nombreCompleto ?? "").trim().toUpperCase(), r.beneficiario, tipo].join("|");
    const ex = best.get(key);
    if (!ex || r.costoFinancieroEfectivoTotalMaximo < ex.costoFinancieroEfectivoTotalMaximo) best.set(key, r);
  }

  return Array.from(best.entries()).map(([key, r], i) => ({
    id:          `${r.codigoEntidad}-${i}`,
    entidad:     displayName(r.codigoEntidad, r.descripcionEntidad),
    tipo:        key.endsWith("|uva") ? ("uva" as const) : ("pesos" as const),
    tipoEntidad: tipoEntidad(r.codigoEntidad, r.descripcionEntidad),
    producto:    (r.nombreCompleto ?? r.nombreCorto ?? "").trim() || undefined,
    perfil:      r.beneficiario ?? "Todos los beneficiarios",
    logo:        bcraLogo(r.codigoEntidad),
    tna:         teaToTna(r.tasaEfectivaAnualMaxima),
    tea:         r.tasaEfectivaAnualMaxima,
    cft:         r.costoFinancieroEfectivoTotalMaximo,
    plazoMax:    r.plazoMaximoOtorgable,
    montoMin:    r.montoMinimoOtorgable,
    montoMax:    r.montoMaximoOtorgable,
    fecha:       r.fechaInformacion,
  }));
}

async function fetchFromBCRA(): Promise<LoanProduct[] | null> {
  try {
    const res = await fetch(BCRA_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`BCRA respondió ${res.status}`);
    const json = (await res.json()) as { results?: BcraPrestamo[] };
    const products = toLoanProducts(json.results ?? [], new Date());
    if (products.length === 0) throw new Error("BCRA sin productos válidos");
    return products;
  } catch (err) {
    console.error("[loans] no se pudo consultar el BCRA:", err);
    return null;
  }
}

let cache: { productos: LoanProduct[]; fetchedAt: number } | null = null;

const FALLBACK_TIPO: Record<string, TipoEntidad> = {
  "Naranja X":    "Compañía financiera",
  "Mercado Pago": "Otra entidad no bancaria",
};

// ─── Server function ──────────────────────────────────────────────────────────

export const getLoanProducts = createServerFn({ method: "GET" }).handler(async () => {
  if (!cache || Date.now() - cache.fetchedAt >= CACHE_TTL_MS) {
    const fresh = await fetchFromBCRA();
    if (fresh) cache = { productos: fresh, fetchedAt: Date.now() };
  }

  // Si el BCRA no responde se usa el último dato obtenido y, si no hay ninguno,
  // los datos estáticos de respaldo.
  const productos =
    cache?.productos ??
    PESOS_PRODUCTS.map((p) => ({
      ...p,
      tipoEntidad: FALLBACK_TIPO[p.entidad] ?? ("Banco" as const),
      perfil: "Todos los beneficiarios",
    })).filter((p) => TIPOS_INCLUIDOS.has(p.tipoEntidad));
  return {
    productos: [...productos].sort((a, b) => a.cft - b.cft),
    fuente: cache ? ("BCRA" as const) : ("respaldo" as const),
  };
});
