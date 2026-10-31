import { createServerFn } from "@tanstack/react-start";

// ─── BCRA — Tasas Plazo Fijo ─────────────────────────────────────────────────

type BCRARate = {
  codigo: number;
  entidad: string;
  logo_url: string;
  tasa_con_relacion: number;   // % TNA clientes
  tasa_sin_relacion: number;   // % TNA no clientes
  web: string;
};

type BCRAResponse = {
  success: boolean;
  top10: BCRARate[];
  otros:  BCRARate[];
};

export type PlazofijRate = {
  entidad: string;
  logo: string | null;
  tnaClientes: number;      // percentage, e.g. 19.0
  tnaNoClientes: number;
  tea: number;              // percentage, computed from tnaClientes
  enlace: string | null;
  condicionesCorto: string | null;
};

const ENTITY_NAMES: Record<string, string> = {
  "BANCO DE LA NACION ARGENTINA":                             "Banco Nación",
  "BANCO DE GALICIA Y BUENOS AIRES S.A.":                    "Banco Galicia",
  "BANCO BBVA ARGENTINA S.A.":                               "BBVA Argentina",
  "BANCO SANTANDER ARGENTINA S.A.":                          "Santander Argentina",
  "BANCO DE LA PROVINCIA DE BUENOS AIRES":                   "Banco Provincia",
  "BANCO MACRO S.A.":                                        "Banco Macro",
  "INDUSTRIAL AND COMMERCIAL BANK OF CHINA (ARGENTINA) S.A.U.": "ICBC Argentina",
  "BANCO DE LA CIUDAD DE BUENOS AIRES":                      "Banco Ciudad",
  "BANCO PATAGONIA S.A.":                                    "Banco Patagonia",
  "BANCO CREDICOOP COOPERATIVO LIMITADO":                    "Banco Credicoop",
  "BANCO BICA S.A.":                                         "Banco Bica",
  "BANCO CMF S.A.":                                          "Banco CMF",
  "BANCO COMAFI SOCIEDAD ANONIMA":                           "Banco Comafi",
  "BANCO DE COMERCIO S.A.":                                  "Banco de Comercio",
  "BANCO DE FORMOSA S.A.":                                   "Banco de Formosa",
  "BANCO DE LA PROVINCIA DE CORDOBA S.A.":                   "Bancor",
  "BANCO DEL CHUBUT S.A.":                                   "Banco del Chubut",
  "BANCO DEL SOL S.A.":                                      "Banco del Sol",
  "BANCO DINO S.A.":                                         "Banco Dino",
  "BANCO HIPOTECARIO S.A.":                                  "Banco Hipotecario",
  "BANCO JULIO SOCIEDAD ANONIMA":                            "Banco Julio",
  "BANCO MARIVA S.A.":                                       "Banco Mariva",
  "BANCO MASVENTAS S.A.":                                    "Banco Masventas",
  "BANCO MERIDIAN S.A.":                                     "Banco Meridian",
  "BANCO PROVINCIA DE TIERRA DEL FUEGO":                     "Banco Tierra del Fuego",
  "BANCO VOII S.A.":                                         "Banco VOII",
  "BIBANK S.A.":                                             "BiBanK",
  "CRÉDITO REGIONAL COMPAÑÍA FINANCIERA S.A.U.":            "Crédito Regional",
  "REBA COMPANIA FINANCIERA S.A.":                           "REBA Financiera",
  "Banco Piano":                                             "Banco Piano",
  "Brubank":                                                 "Brubank",
  "UALA":                                                    "Ualá",
};

// ─── ArgentinaDatos — Cuentas Remuneradas / Billeteras ───────────────────────

type ArgDatosCuenta = {
  fondo: string;
  tna: number;
  tope: number | null;
  fecha: string;
  condiciones: string | null;
  condicionesCorto: string | null;
};

type FCIFondo = {
  nombre: string;
  tipoRenta: string;
  plazoLiquidacionDias: number;
  fecha: string;
  rendimientos: { ultimos7Dias: number } | null;
};

// Mapeo: nombre exacto del fondo FCI → entidad comercial que lo distribuye
const FCI_MONEY_MARKET: Record<string, string> = {
  "Mercado Fondo - Clase A":             "Mercado Pago",
  "Ualintec Ahorro Pesos - Clase A":     "Ualá",
  "Vinci Compass Liquidez - Clase F":    "Lemon Cash",
  "Delta Pesos - Clase X":               "Personal Pay",
  "Delta Pesos - Clase A":               "Fiwind",
  "Cocos Ahorro - Clase A":              "Cocos",
  "Premier Renta CP en Pesos - Clase A": "Banco Supervielle",
  "Fima Premium - Clase A":              "Banco Galicia",
};

export type CuentaRemunRate = {
  nombre: string;
  tna: number;              // percentage, e.g. 27
  tea: number;              // percentage
  tope: string | null;      // cap formatted, e.g. "hasta $1M"
  fecha: string;
  condicionesCorto: string | null;
};

const CUENTA_NAMES: Record<string, string> = {
  "NARANJA X":             "Naranja X",
  "UALA":                  "Ualá",
  "UALA PLUS 1":           "Ualá Plus",
  "UALA PLUS 2":           "Ualá Plus (max)",
  "BRUBANK":               "Brubank",
  "FIWIND":                "Fiwind",
  "BELO":                  "Belo",
  "CARREFOUR BANCO":       "Carrefour Banco",
  "BNA":                   "Banco Nación",
  "SUPERVIELLE":           "Banco Supervielle",
  "SUPERVIELLE HIT IOL":   "Supervielle Hit IOL",
  "MONTEMAR PAY":          "Montemar Pay",
  "CRESIUM":               "Cresium",
  "BICA CUENTA POSITIVA 1": "Banco Bica (> $20M)",
  "BICA CUENTA POSITIVA 2": "Banco Bica ($2.25M–$20M)",
  "BICA CUENTA POSITIVA 3": "Banco Bica ($750K–$2.25M)",
  "BICA CUENTA POSITIVA 4": "Banco Bica (hasta $750K)",
};

function formatTope(tope: number | null): string | null {
  if (tope === null) return null;
  if (tope >= 1_000_000) return `hasta $${(tope / 1_000_000).toFixed(0)}M`;
  if (tope >= 1_000)     return `hasta $${(tope / 1_000).toFixed(0)}K`;
  return `hasta $${tope}`;
}

export const getCuentasRemuneradas = createServerFn({ method: "GET" }).handler(async () => {
  const fciCovered = new Set(Object.values(FCI_MONEY_MARKET));

  const [otrosRes, fondosRes] = await Promise.all([
    fetch("https://api.argentinadatos.com/v1/finanzas/fci/otros/ultimo", {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    }),
    fetch("https://api.argentinadatos.com/v1/finanzas/fci/fondos", {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    }),
  ]);
  if (!otrosRes.ok) throw new Error(`ArgentinaDatos /otros respondió ${otrosRes.status}`);
  if (!fondosRes.ok) throw new Error(`ArgentinaDatos /fondos respondió ${fondosRes.status}`);

  const otrosData  = (await otrosRes.json()) as ArgDatosCuenta[];
  const fondosData = (await fondosRes.json()) as { fondos: FCIFondo[] };

  // Billeteras y cuentas no-FCI — excluir entidades ya cubiertas por FCI
  const fromOtros: CuentaRemunRate[] = otrosData
    .filter((r) => r.tna > 0)
    .map((r): CuentaRemunRate => ({
      nombre:           CUENTA_NAMES[r.fondo] ?? r.fondo,
      tna:              Math.round(r.tna * 10000) / 100,
      tea:              tnaToTea(r.tna * 100),
      tope:             formatTope(r.tope),
      fecha:            r.fecha,
      condicionesCorto: r.condicionesCorto ?? null,
    }))
    .filter((r) => !fciCovered.has(r.nombre));

  // Fondos Money Market conocidos → nombre de entidad comercial
  const fromFCI: CuentaRemunRate[] = fondosData.fondos
    .filter((f) => FCI_MONEY_MARKET[f.nombre] && (f.rendimientos?.ultimos7Dias ?? 0) > 0)
    .map((f): CuentaRemunRate => ({
      nombre:           FCI_MONEY_MARKET[f.nombre],
      tna:              Math.round((f.rendimientos!.ultimos7Dias) * 100) / 100,
      tea:              tnaToTea(f.rendimientos!.ultimos7Dias),
      tope:             null,
      fecha:            f.fecha,
      condicionesCorto: null,
    }));

  return {
    billeteras: fromOtros.sort((a, b) => b.tna - a.tna),
    fci:        fromFCI.sort((a, b) => b.tna - a.tna),
  };
});

export const getPlazofijo = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch("https://www.bcra.gob.ar/api/endpoints/plazos-fijos.php", {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`BCRA respondió ${res.status}`);
  const data = (await res.json()) as BCRAResponse;
  const all  = [...(data.top10 ?? []), ...(data.otros ?? [])];
  return all
    .map((r): PlazofijRate => ({
      entidad:          ENTITY_NAMES[r.entidad.trim()] ?? r.entidad.trim(),
      logo:             r.logo_url ? r.logo_url.replace("http://", "https://") : null,
      tnaClientes:      r.tasa_con_relacion,
      tnaNoClientes:    r.tasa_sin_relacion,
      tea:              tnaToTea(r.tasa_con_relacion),
      enlace:           r.web || null,
      condicionesCorto: null,
    }))
    .sort((a, b) => b.tnaClientes - a.tnaClientes);
});

// TNA (% anual, capitalización diaria) → TEA (% anual)
function tnaToTea(tna: number): number {
  return Math.round((Math.pow(1 + tna / 100 / 365, 365) - 1) * 1000) / 10;
}
