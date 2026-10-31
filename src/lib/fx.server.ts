// Tipo de cambio minorista USD/ARS publicado por el BCRA
// (Com. B 9791 — promedio vendedor, variable 4 de la API de Estadísticas v4.0).
// Es el mismo valor que figura en la portada de https://www.bcra.gob.ar/.

const BCRA_URL = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/4?limit=1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // el BCRA lo publica una vez por día hábil

// Valor de referencia si el BCRA no responde y todavía no hay dato en caché
const FALLBACK_USD_TO_ARS = 1500;

export type TipoCambio = {
  valor: number;
  fecha: string | null; // YYYY-MM-DD informado por el BCRA
  fuente: "BCRA" | "referencia";
};

let cache: { data: TipoCambio; fetchedAt: number } | null = null;

async function fetchFromBCRA(): Promise<TipoCambio | null> {
  try {
    const res = await fetch(BCRA_URL, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: { detalle?: { fecha: string; valor: number }[] }[];
    };
    const last = json.results?.[0]?.detalle?.[0];
    if (!last || typeof last.valor !== "number" || last.valor <= 0) return null;
    return { valor: last.valor, fecha: last.fecha, fuente: "BCRA" };
  } catch {
    return null;
  }
}

export async function getTipoCambioMinorista(): Promise<TipoCambio> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  const fresh = await fetchFromBCRA();
  if (fresh) {
    cache = { data: fresh, fetchedAt: Date.now() };
    return fresh;
  }
  // Si falla, se mantiene el último valor conocido del BCRA
  if (cache) return cache.data;
  return { valor: FALLBACK_USD_TO_ARS, fecha: null, fuente: "referencia" };
}
