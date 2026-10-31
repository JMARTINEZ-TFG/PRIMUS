import { createServerFn } from "@tanstack/react-start";
import { getTipoCambioMinorista, type TipoCambio } from "../fx.server";

export type { TipoCambio };

export const getTipoCambio = createServerFn({ method: "GET" }).handler(async () => {
  return getTipoCambioMinorista();
});
