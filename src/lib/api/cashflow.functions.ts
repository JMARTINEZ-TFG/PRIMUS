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
  rango: z.enum(["1m", "3m", "6m", "1y"]).optional(),
  months: z.record(mesKey, z.object({
    initialized: z.boolean(),
    ingresos: z.array(z.object({ id, nombre: texto, importe })).max(200),
    egresos: z.array(z.object({ id, concepto: texto, importe })).max(500),
  })),
});

export type CashflowData = z.infer<typeof cashflowSchema>;

// Proyección guardada y su versión: cada guardado la incrementa en 1
export type CashflowGuardado = { datos: CashflowData; version: number };

let _tablaCreada = false;

async function ensureTable() {
  if (_tablaCreada) return;
  const db = getDb();
  await db.query(
    `CREATE TABLE IF NOT EXISTS proyeccion_cashflow (
       id_usuario     INTEGER PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
       datos          JSONB NOT NULL,
       version        INTEGER NOT NULL DEFAULT 1,
       actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  await db.query(`ALTER TABLE proyeccion_cashflow ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`);
  _tablaCreada = true;
}

// null si el usuario todavía no guardó ninguna proyección
export const getCashflow = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  await ensureTable();
  const { rows } = await getDb().query<CashflowGuardado>(
    "SELECT datos, version FROM proyeccion_cashflow WHERE id_usuario = $1",
    [session.userId],
  );
  return rows[0] ?? null;
});

// Guarda solo si la versión en la base es la que tenía la pantalla (null: todavía
// no había nada). Si otro dispositivo guardó antes, no la pisa y devuelve ok: false.
export const saveCashflow = createServerFn({ method: "POST" })
  .inputValidator(z.object({ datos: cashflowSchema, version: z.number().int().positive().nullable() }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    await ensureTable();
    const datos = JSON.stringify(data.datos);
    const { rows } = data.version === null
      ? await getDb().query<{ version: number }>(
          `INSERT INTO proyeccion_cashflow (id_usuario, datos) VALUES ($1, $2)
           ON CONFLICT (id_usuario) DO NOTHING
           RETURNING version`,
          [session.userId, datos],
        )
      : await getDb().query<{ version: number }>(
          `UPDATE proyeccion_cashflow
           SET datos = $2, version = version + 1, actualizado_en = NOW()
           WHERE id_usuario = $1 AND version = $3
           RETURNING version`,
          [session.userId, datos, data.version],
        );
    return rows[0] ? { ok: true as const, version: rows[0].version } : { ok: false as const };
  });
