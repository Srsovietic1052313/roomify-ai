import { beforeEach, describe, expect, it, vi } from "vitest";
import { CARPETA_IMAGENES, crearServicio, validarArchivo } from "../src/lib/proyectos";
import type { Proyecto, PuterApi } from "../src/lib/tipos";

function puterFalso() {
  const kv = new Map<string, unknown>();
  return {
    auth: { signIn: vi.fn(), signOut: vi.fn(), isSignedIn: () => true, getUser: vi.fn() },
    ai: { txt2img: vi.fn(async () => ({ src: "temporal" }) as HTMLImageElement) },
    kv: {
      set: vi.fn(async (k: string, v: unknown) => { kv.set(k, v); return true; }),
      get: vi.fn(async (k: string) => kv.get(k) ?? null) as PuterApi["kv"]["get"],
      list: vi.fn(async (p: string) =>
        [...kv].filter(([k]) => k.startsWith(p.replace("*", ""))).map(([key, value]) => ({ key, value }))),
      del: vi.fn(async (k: string) => kv.delete(k)),
    },
    fs: { write: vi.fn(async () => ({})), mkdir: vi.fn(async () => ({})) },
    hosting: { create: vi.fn(async (subdomain: string) => ({ subdomain })) },
    workers: { exec: vi.fn(async () => new Response("{}", { status: 201 })) },
  };
}

const archivo = (nombre = "casa.png", tipo = "image/png") => new File(["x"], nombre, { type: tipo });

describe("validarArchivo", () => {
  it("acepta imágenes válidas y rechaza el resto", () => {
    expect(validarArchivo({ type: "image/png", size: 10 })).toBeNull();
    expect(validarArchivo({ type: "application/pdf", size: 10 })).toMatch(/PNG/);
    expect(validarArchivo({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(validarArchivo({ type: "image/png", size: 0 })).toMatch(/vacío/);
  });
});

describe("servicio de proyectos", () => {
  let puter: ReturnType<typeof puterFalso>;
  beforeEach(() => { puter = puterFalso(); });

  it("publica la carpeta una sola vez aunque se creen varios proyectos", async () => {
    const servicio = crearServicio(puter);
    const a = await servicio.crear(archivo());
    await servicio.crear(archivo("otra.png"));
    expect(puter.hosting.create).toHaveBeenCalledTimes(1);
    expect(puter.fs.write).toHaveBeenCalledTimes(2);
    expect(a.plantaUrl).toMatch(/^https:\/\/roomify-[\w-]+\.puter\.site\/.+-planta\.png$/);
    expect(a.nombre).toBe("casa");
  });

  it("no sube archivos no permitidos", async () => {
    await expect(crearServicio(puter).crear(archivo("a.pdf", "application/pdf"))).rejects.toThrow();
    expect(puter.fs.write).not.toHaveBeenCalled();
  });

  it("genera el render desde el plano y guarda una URL permanente", async () => {
    const servicio = crearServicio(puter);
    const proyecto = await servicio.crear(archivo());
    const conRender = await servicio.generarRender(proyecto);
    const [, opciones] = puter.ai.txt2img.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(opciones.input_image).toBe(proyecto.plantaUrl);
    expect(opciones.puter_output_path).toBe(`${CARPETA_IMAGENES}/${proyecto.id}-render.png`);
    expect(conRender.renderUrl).toMatch(/\.puter\.site\/.+-render\.png$/);
    expect((await servicio.obtener(proyecto.id))?.renderUrl).toBe(conRender.renderUrl);
  });

  it("no guarda nada si la IA falla", async () => {
    const servicio = crearServicio(puter);
    const proyecto = await servicio.crear(archivo());
    puter.ai.txt2img.mockRejectedValueOnce(new Error("upstream_failed"));
    await expect(servicio.generarRender(proyecto)).rejects.toThrow("upstream_failed");
    expect((await servicio.obtener(proyecto.id))?.renderUrl).toBeNull();
  });

  it("lista del más nuevo al más antiguo", async () => {
    const base = { nombre: "", plantaUrl: "", renderUrl: null, publico: false };
    await puter.kv.set("proyecto:1", { ...base, id: "1", creadoEn: "2026-01-01" });
    await puter.kv.set("proyecto:2", { ...base, id: "2", creadoEn: "2026-02-01" });
    await puter.kv.set("hosting:subdominio", "no-es-proyecto");
    const lista = await crearServicio(puter).listar();
    expect(lista.map((p) => p.id)).toEqual(["2", "1"]);
  });

  it("no publica sin render ni sin worker", async () => {
    const p: Proyecto = { id: "1", nombre: "", creadoEn: "", plantaUrl: "", renderUrl: null, publico: false };
    await expect(crearServicio(puter).cambiarPublicacion(p, true)).rejects.toThrow(/configurado/);
    await expect(crearServicio(puter, { urlWorker: "https://w" }).cambiarPublicacion(p, true)).rejects.toThrow(/render/);
  });

  it("publica mediante workers.exec para enviar la sesión", async () => {
    const servicio = crearServicio(puter, { urlWorker: "https://w" });
    const p: Proyecto = { id: "1", nombre: "n", creadoEn: "", plantaUrl: "u", renderUrl: "r", publico: false };
    const r = await servicio.cambiarPublicacion(p, true);
    expect(puter.workers.exec).toHaveBeenCalledWith("https://w/api/feed", expect.objectContaining({ method: "POST" }));
    expect(r.publico).toBe(true);
  });
});
