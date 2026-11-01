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
  // ultimos7Dias es el rendimiento (%) de los últimos 7 días, sin anualizar;
  // tnaEstimada es la TNA (%) estimada por ArgentinaDatos sobre el último mes
  rendimientos: { ultimos7Dias?: number; tnaEstimada?: number } | null;
};

// TNA (%) de un FCI: la estimada por la API o, si falta, el rendimiento de 7 días anualizado
function fciTna(f: FCIFondo): number {
  const r = f.rendimientos;
  if (r?.tnaEstimada != null && r.tnaEstimada > 0) return r.tnaEstimada;
  if (r?.ultimos7Dias != null && r.ultimos7Dias > 0) return (r.ultimos7Dias * 365) / 7;
  return 0;
}

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
  variantes?: CuentaVariante[]; // otras modalidades de la misma cuenta, p. ej. "Frascos 7-13"
};

export type CuentaVariante = {
  nombre: string;           // modalidad, p. ej. "Frascos 14-27"
  tna: number;
  tea: number;
  tope: string | null;
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

// "NARANJA X FRASCOS 14-27" → cuenta "Naranja X", modalidad "Frascos 14-27".
// Los nombres con traducción propia (Ualá Plus, tramos de Bica) no se agrupan.
function cuentaBase(fondo: string): { nombre: string; variante: string | null } {
  if (CUENTA_NAMES[fondo]) return { nombre: CUENTA_NAMES[fondo], variante: null };
  const base = Object.keys(CUENTA_NAMES)
    .filter((k) => fondo.startsWith(`${k} `))
    .sort((a, b) => b.length - a.length)[0];
  if (!base) return { nombre: fondo, variante: null };
  const resto = fondo.slice(base.length + 1).toLowerCase();
  return { nombre: CUENTA_NAMES[base], variante: resto.charAt(0).toUpperCase() + resto.slice(1) };
}

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
  const filas = otrosData
    .filter((r) => r.tna > 0)
    .map((r) => {
      const { nombre, variante } = cuentaBase(r.fondo);
      const fila: CuentaRemunRate = {
        nombre,
        tna:              Math.round(r.tna * 10000) / 100,
        tea:              tnaToTea(r.tna * 100),
        tope:             formatTope(r.tope),
        fecha:            r.fecha,
        condicionesCorto: r.condicionesCorto ?? null,
      };
      return { fila, variante };
    })
    .filter(({ fila }) => !fciCovered.has(fila.nombre));

  // Una fila por cuenta: las modalidades de la misma cuenta (p. ej. los "Frascos"
  // de Naranja X) se agrupan en la de mayor TNA, priorizando la cuenta principal
  const porCuenta = new Map<string, typeof filas>();
  for (const f of filas) {
    if (!porCuenta.has(f.fila.nombre)) porCuenta.set(f.fila.nombre, []);
    porCuenta.get(f.fila.nombre)!.push(f);
  }
  const fromOtros: CuentaRemunRate[] = [...porCuenta.values()].map((grupo) => {
    const [principal, ...otras] = [...grupo].sort(
      (a, b) => b.fila.tna - a.fila.tna || Number(a.variante !== null) - Number(b.variante !== null),
    );
    if (otras.length === 0) return principal.fila;
    const variantes: CuentaVariante[] = otras
      .map((o) => ({
        nombre:           o.variante ?? "Cuenta",
        tna:              o.fila.tna,
        tea:              o.fila.tea,
        tope:             o.fila.tope,
        condicionesCorto: o.fila.condicionesCorto,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
    return { ...principal.fila, variantes };
  });

  // Fondos Money Market conocidos → nombre de entidad comercial
  const fromFCI: CuentaRemunRate[] = fondosData.fondos
    .filter((f) => FCI_MONEY_MARKET[f.nombre] && fciTna(f) > 0)
    .map((f): CuentaRemunRate => ({
      nombre:           FCI_MONEY_MARKET[f.nombre],
      tna:              Math.round(fciTna(f) * 100) / 100,
      tea:              tnaToTea(fciTna(f)),
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
