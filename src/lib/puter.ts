import type { PuterApi } from "./tipos";

declare global {
  interface Window {
    puter?: PuterApi;
  }
}

let simulado: Promise<PuterApi> | null = null;

/** Devuelve Puter real o, solo con `npm run demo`, una versión simulada en memoria. */
export async function obtenerPuter(): Promise<PuterApi> {
  if (import.meta.env.VITE_PUTER_MOCK === "true") {
    simulado ??= import("./puterSimulado").then((m) => m.crearPuterSimulado());
    return simulado;
  }
  if (!window.puter) {
    throw new Error("No se pudo cargar Puter.js. Revisa tu conexión y recarga la página.");
  }
  return window.puter;
}
