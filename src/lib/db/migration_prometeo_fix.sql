-- =============================================================
-- Primus FinFlow — Fix: índice único de cuentas Prometeo por usuario
-- Corrige el bug donde el segundo usuario que vincula la misma
-- cuenta (mismo prometeo_account_id en sandbox/mock) no creaba
-- una fila propia, sino que actualizaba la del primer usuario.
-- Ejecutar en Neon SQL Editor (solo una vez).
-- =============================================================

-- 1. Eliminar el índice único GLOBAL (colisionaba entre usuarios)
DROP INDEX IF EXISTS cuenta_prometeo_account_unique;

-- 2. Crear índice único POR USUARIO: un mismo prometeo_account_id
--    puede existir para distintos usuarios, pero no duplicarse dentro
--    del mismo usuario.
CREATE UNIQUE INDEX IF NOT EXISTS cuenta_usuario_prometeo_unique
  ON cuenta (id_usuario, prometeo_account_id)
  WHERE prometeo_account_id IS NOT NULL;
