import type { PuterApi } from "./tipos";

/** Reemplazo en memoria para ver la interfaz sin cuenta. No usa IA: el "render" es la misma imagen en color sepia. */
export function crearPuterSimulado(): PuterApi {
  const kv = new Map<string, unknown>();
  let conectado = false;

  return {
    auth: {
      signIn: async () => { conectado = true; },
      signOut: () => { conectado = false; },
      isSignedIn: () => conectado,
      getUser: async () => ({ username: "usuario-demo", uuid: "demo" }),
    },
    ai: {
      txt2img: async (_prompt, opciones) => {
        const original = await cargarImagen(String(opciones.input_image));
        const lienzo = document.createElement("canvas");
        lienzo.width = original.naturalWidth;
        lienzo.height = original.naturalHeight;
        const ctx = lienzo.getContext("2d")!;
        ctx.filter = "sepia(1) saturate(2)";
        ctx.drawImage(original, 0, 0);
        const resultado = new Image();
        resultado.src = lienzo.toDataURL("image/png");
        return resultado;
      },
    },
    kv: {
      set: async (clave, valor) => { kv.set(clave, valor); return true; },
      get: async <T,>(clave: string) => (kv.get(clave) as T) ?? null,
      list: async (patron) => {
        const prefijo = patron.replace(/\*$/, "");
        return [...kv].filter(([k]) => k.startsWith(prefijo)).map(([key, value]) => ({ key, value }));
      },
      del: async (clave) => { kv.delete(clave); return true; },
    },
    fs: { write: async () => ({}), mkdir: async () => ({}) },
    hosting: { create: async (subdomain) => ({ subdomain }) },
    workers: { exec: async () => new Response("[]") },
  };
}

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
    imagen.src = src;
  });
}
