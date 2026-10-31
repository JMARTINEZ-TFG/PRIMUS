import { createServerFn } from "@tanstack/react-start";
import { PESOS_PRODUCTS, type LoanProduct } from "./loans-data";

// ─── BCRA — Régimen de Transparencia: Préstamos Personales ───────────────────
// API oficial: https://api.bcra.gob.ar/transparencia/v1.0/Prestamos/Personales
// Cada entidad informa sus productos con su propia fecha (fechaInformacion).

const BCRA_URL = "https://api.bcra.gob.ar/transparencia/v1.0/Prestamos/Personales";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type BcraPrestamo = {
  codigoEntidad: number;
  descripcionEntidad: string;
  fechaInformacion: string;
  nombreCorto: string;
  denominacion: string | null;
  montoMinimoOtorgable: number;
  montoMaximoOtorgable: number;
  plazoMaximoOtorgable: number;
  tasaEfectivaAnualMaxima: number;
  costoFinancieroEfectivoTotalMaximo: number;
};

type AllowedProduct = {
  entityPrefix: string;      // inicio de "descripcionEntidad" en mayúsculas
  shortName: string | null;  // "nombreCorto" exacto en mayúsculas; null = cualquier producto de la entidad
  display: string;           // nombre de display en la UI
  id: string;                // slug para el campo id
};

// Lista exacta de los productos a mostrar, identificados por entidad + nombre corto.
// Si hay varias filas que coinciden (distintos tramos, territorios, etc.)
// se elige la de menor CFT.
const ALLOWED_PRODUCTS: AllowedProduct[] = [
  { entityPrefix: "BANCO DE LA PROVINCIA DE BUENOS AIRES", shortName: "PRESTAMO PERSONAL",        display: "Banco Provincia",   id: "bapro"      },
  { entityPrefix: "BANCO DE LA PROVINCIA DE CORDOBA",      shortName: "PP MULTIDESTINO",          display: "Bancor",            id: "bancor"     },
  { entityPrefix: "BANCO DE LA NACION ARGENTINA",          shortName: "NACION LIBRE DESTINO",     display: "Banco Nación",      id: "bna"        },
  { entityPrefix: "BANCO MACRO",                           shortName: "PRESTAMOS PERSONALES",     display: "Banco Macro",       id: "macro"      },
  { entityPrefix: "BANCO DE LA CIUDAD DE BUENOS AIRES",    shortName: "CIUDAD VELOZ PLAN SUELDO", display: "Banco Ciudad",      id: "ciudad"     },
  { entityPrefix: "BANCO SANTANDER ARGENTINA",             shortName: "SUPER PRESTAMO PERSONAL",  display: "Santander",         id: "santander"  },
  { entityPrefix: "BANCO PATAGONIA",                       shortName: "PP PLUS",                  display: "Banco Patagonia",   id: "patagonia"  },
  { entityPrefix: "BANCO SUPERVIELLE",                     shortName: "PP",                       display: "Banco Supervielle", id: "supervielle"},
  { entityPrefix: "BANCO BBVA ARGENTINA",                  shortName: "PRESTAMO PERSONAL",        display: "BBVA",              id: "bbva"       },
  // Galicia informa varias variantes (PPMINPLUS, PPMAXEMINENT, …): se toma la de menor CFT
  { entityPrefix: "BANCO DE GALICIA Y BUENOS AIRES",       shortName: null,                       display: "Banco Galicia",     id: "galicia"    },
  { entityPrefix: "NARANJA DIGITAL",                       shortName: "PRESTAMOS PERSONALES",     display: "Naranja X",         id: "naranjax"   },
  { entityPrefix: "UALA BANK",                             shortName: "PRESTAMOS PERSONALES",     display: "Ualá",              id: "uala"       },
  { entityPrefix: "MERCADOLIBRE",                          shortName: "PRESTAMO PERSONAL",        display: "Mercado Pago",      id: "mercadopago"},
  { entityPrefix: "BRUBANK",                               shortName: "PP RIESGO MEDIO BAJO",     display: "Brubank",           id: "brubank"    },
];

function findProduct(entityName: string, shortName: string): AllowedProduct | null {
  const upperEntity = entityName.trim().toUpperCase();
  const upperShort  = shortName.trim().toUpperCase();
  for (const p of ALLOWED_PRODUCTS) {
    if (upperEntity.startsWith(p.entityPrefix) && (p.shortName === null || upperShort === p.shortName)) return p;
  }
  return null;
}

function teaToTna(tea: number): number {
  if (tea <= 0) return 0;
  return Math.round(12 * (Math.pow(1 + tea / 100, 1 / 12) - 1) * 1000) / 10;
}

function toLoanProducts(rows: BcraPrestamo[]): LoanProduct[] {
  type Row = { product: AllowedProduct; r: BcraPrestamo };

  const matches: Row[] = rows.flatMap((r) => {
    if (r.denominacion !== "Pesos") return [];
    const product = findProduct(r.descripcionEntidad ?? "", r.nombreCorto ?? "");
    if (!product) return [];
    if (!(r.tasaEfectivaAnualMaxima > 0) || !(r.costoFinancieroEfectivoTotalMaximo > 0)) return [];
    return [{ product, r }];
  });

  // Por cada producto, quedarse con la fila de menor CFT
  const groups = new Map<string, Row>();
  for (const m of matches) {
    const ex = groups.get(m.product.id);
    if (!ex || m.r.costoFinancieroEfectivoTotalMaximo < ex.r.costoFinancieroEfectivoTotalMaximo) {
      groups.set(m.product.id, m);
    }
  }

  return Array.from(groups.values()).map(({ product, r }) => ({
    id:       `${product.id}-pesos`,
    entidad:  product.display,
    tipo:     "pesos" as const,
    tna:      teaToTna(r.tasaEfectivaAnualMaxima),
    tea:      r.tasaEfectivaAnualMaxima,
    cft:      r.costoFinancieroEfectivoTotalMaximo,
    plazoMax: r.plazoMaximoOtorgable,
    montoMin: r.montoMinimoOtorgable,
    montoMax: r.montoMaximoOtorgable,
    fecha:    r.fechaInformacion,
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
    const products = toLoanProducts(json.results ?? []);
    if (products.length === 0) throw new Error("BCRA sin productos válidos");
    return products;
  } catch (err) {
    console.error("[loans] no se pudo consultar el BCRA:", err);
    return null;
  }
}

let cache: { pesos: LoanProduct[]; fetchedAt: number } | null = null;

// ─── Server function ──────────────────────────────────────────────────────────

export const getLoanProducts = createServerFn({ method: "GET" }).handler(async () => {
  if (!cache || Date.now() - cache.fetchedAt >= CACHE_TTL_MS) {
    const fresh = await fetchFromBCRA();
    if (fresh) cache = { pesos: fresh, fetchedAt: Date.now() };
  }

  // Si el BCRA no responde se usa el último dato obtenido y, si no hay ninguno,
  // los datos estáticos de respaldo.
  const pesos = cache?.pesos ?? PESOS_PRODUCTS;
  return {
    pesos:  [...pesos].sort((a, b) => a.cft - b.cft),
    fuente: cache ? ("BCRA" as const) : ("respaldo" as const),
  };
});
