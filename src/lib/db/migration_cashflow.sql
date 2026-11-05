-- =============================================================
-- Primus FinFlow — Migración: Proyecciones de Cash Flow
-- La aplicación la crea sola si no existe (cashflow.functions.ts);
-- este archivo documenta la tabla.
-- =============================================================

-- Una fila por usuario con el estado completo de su proyección: fuentes de
-- ingreso, egresos (manuales o importados de obligaciones) y los valores
-- editados de cada mes.
CREATE TABLE IF NOT EXISTS proyeccion_cashflow (
  id_usuario     INTEGER PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  datos          JSONB NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
