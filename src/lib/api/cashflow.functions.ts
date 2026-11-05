import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db.server";
import { getSession } from "../session.server";

// Estado de la pantalla de Cash Flow, guardado como un documento JSON por usuario
// (ver db/migration_cashflow.sql)

const mesKey = z.string().regex(/^\d{4}-\d{2}$/);
const id = z.string().min(1).max(64);
const texto = z.string().max(500);
const importe = z.number().finite();

const cashflowSchema = z.object({
  sources: z.array(z.object({ id, nombre: texto, importe, desde: mesKey.optional() })).max(200),
  imported: z.array(id).max(500),
  overrides: z.record(id, z.object({ monto: z.string().max(30), desde: mesKey.optional() })),
  manual: z.array(z.object({ id, emisor: texto, monto: z.string().max(30), desde: mesKey.optional() })).max(200),
  months: z.record(mesKey, z.object({
    initialized: z.boolean(),
    ingresos: z.array(z.object({ id, nombre: texto, importe })).max(200),
    egresos: z.array(z.object({ id, concepto: texto, importe })).max(500),
  })),
});

export type CashflowData = z.infer<typeof cashflowSchema>;

let _tablaCreada = false;

async function ensureTable() {
  if (_tablaCreada) return;
  await getDb().query(
    `CREATE TABLE IF NOT EXISTS proyeccion_cashflow (
       id_usuario     INTEGER PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
       datos          JSONB NOT NULL,
       actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  _tablaCreada = true;
}

// null si el usuario todavía no guardó ninguna proyección
export const getCashflow = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  await ensureTable();
  const { rows } = await getDb().query<{ datos: CashflowData }>(
    "SELECT datos FROM proyeccion_cashflow WHERE id_usuario = $1",
    [session.userId],
  );
  return rows[0]?.datos ?? null;
});

export const saveCashflow = createServerFn({ method: "POST" })
  .inputValidator(cashflowSchema)
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    await ensureTable();
    await getDb().query(
      `INSERT INTO proyeccion_cashflow (id_usuario, datos, actualizado_en)
       VALUES ($1, $2, NOW())
       ON CONFLICT (id_usuario) DO UPDATE SET datos = EXCLUDED.datos, actualizado_en = NOW()`,
      [session.userId, JSON.stringify(data)],
    );
    return { ok: true };
  });
