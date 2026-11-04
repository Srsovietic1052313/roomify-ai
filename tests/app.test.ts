import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearApp } from "../server/app.ts";
import { abrirBase, crearRepositorio } from "../server/db.ts";
import { ErrorApi } from "../server/errores.ts";
import { crearCloudflare, type ProveedorIa } from "../server/ia.ts";

const png = (ancho = 800, alto = 400) =>
  sharp({ create: { width: ancho, height: alto, channels: 3, background: "white" } }).png().toBuffer();

let servidor: Server;
let base: string;
let carpeta: string;
let ia: ProveedorIa;

function arrancar(iaUsada: ProveedorIa) {
  carpeta = mkdtempSync(path.join(os.tmpdir(), "roomify-"));
  ia = iaUsada;
  const app = crearApp({ repositorio: crearRepositorio(abrirBase(":memory:")), carpetaImagenes: carpeta, ia });
  return new Promise<void>((resolver) => {
    servidor = app.listen(0, "127.0.0.1", () => {
      base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
      resolver();
    });
  });
}

const iaFalsa = (): ProveedorIa => ({ nombre: "simulado", configurado: true, generar: vi.fn(async () => png(100, 100)) });

async function subir(datos: Buffer | string, nombre = "Casa Ñandú.png") {
  const formulario = new FormData();
  formulario.append("plano", new Blob([datos as BlobPart]), nombre);
  return fetch(`${base}/api/proyectos`, { method: "POST", body: formulario });
}

beforeEach(() => arrancar(iaFalsa()));
afterEach(() => {
  servidor.close();
  rmSync(carpeta, { recursive: true, force: true });
});

describe("proyectos", () => {
  it("guarda el plano y conserva los acentos del nombre", async () => {
    const r = await subir(await png());
    expect(r.status).toBe(201);
    const proyecto = await r.json();
    expect(proyecto.renderUrl).toBeNull();
    expect(proyecto.nombre).toBe("Casa Ñandú");
    expect((await fetch(base + proyecto.plantaUrl)).status).toBe(200);
    expect(await (await fetch(`${base}/api/proyectos`)).json()).toHaveLength(1);
  });

  it("rechaza archivos que no son imágenes aunque se llamen .png", async () => {
    const r = await subir("<svg onload=alert(1)>", "ataque.png");
    expect(r.status).toBe(400);
    expect(readdirSync(carpeta)).toEqual([]);
  });

  it("rechaza archivos de más de 10 MB", async () => {
    const r = await subir(Buffer.alloc(11 * 1024 * 1024));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/10 MB/);
  });

  it("da 404 si el proyecto no existe", async () => {
    expect((await fetch(`${base}/api/proyectos/nada`)).status).toBe(404);
    expect((await fetch(`${base}/api/proyectos/nada/render`, { method: "POST" })).status).toBe(404);
  });

  it("genera el render, reemplaza el anterior y borra los archivos al eliminar", async () => {
    const { id } = await (await subir(await png())).json();
    const primero = await (await fetch(`${base}/api/proyectos/${id}/render`, { method: "POST" })).json();
    expect(primero.renderUrl).toMatch(/-render-\d+\.png$/);
    await new Promise((r) => setTimeout(r, 5));
    await fetch(`${base}/api/proyectos/${id}/render`, { method: "POST" });
    expect(readdirSync(carpeta)).toHaveLength(2);

    const pedido = vi.mocked(ia.generar).mock.calls[0][0];
    const referencia = await sharp(pedido.referencia).metadata();
    expect(Math.max(referencia.width!, referencia.height!)).toBeLessThan(512);
    expect(pedido).toMatchObject({ width: 1024, height: 512 });

    expect((await fetch(`${base}/api/proyectos/${id}`, { method: "DELETE" })).status).toBe(204);
    expect(readdirSync(carpeta)).toEqual([]);
    expect(existsSync(carpeta)).toBe(true);
  });

  it("si la IA falla, muestra su mensaje y conserva el proyecto", async () => {
    const { id } = await (await subir(await png())).json();
    vi.mocked(ia.generar).mockRejectedValueOnce(new ErrorApi(429, "Límite alcanzado."));
    const r = await fetch(`${base}/api/proyectos/${id}/render`, { method: "POST" });
    expect(r.status).toBe(429);
    expect((await r.json()).error).toBe("Límite alcanzado.");
    expect((await (await fetch(`${base}/api/proyectos/${id}`)).json()).renderUrl).toBeNull();
  });

  it("no guarda un render que no sea una imagen", async () => {
    const { id } = await (await subir(await png())).json();
    vi.mocked(ia.generar).mockResolvedValueOnce(Buffer.from("no soy imagen"));
    expect((await fetch(`${base}/api/proyectos/${id}/render`, { method: "POST" })).status).toBe(502);
    expect(readdirSync(carpeta)).toHaveLength(1);
  });

  it("no oculta errores internos", async () => {
    const { id } = await (await subir(await png())).json();
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(ia.generar).mockRejectedValueOnce(new Error("secreto interno"));
    const r = await fetch(`${base}/api/proyectos/${id}/render`, { method: "POST" });
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain("secreto");
    consola.mockRestore();
  });
});

describe("seguridad local", () => {
  it("bloquea peticiones enviadas desde otros sitios web", async () => {
    const r = await fetch(`${base}/api/proyectos`, { headers: { Origin: "https://malicioso.example" } });
    expect(r.status).toBe(403);
    expect((await fetch(`${base}/api/proyectos`, { headers: { Origin: base } })).status).toBe(200);
  });
});

describe("sin configurar", () => {
  it("avisa en vez de intentar generar", async () => {
    servidor.close();
    await arrancar(crearCloudflare({}));
    expect(await (await fetch(`${base}/api/estado`)).json()).toEqual({ proveedor: "cloudflare", configurado: false });
    const { id } = await (await subir(await png())).json();
    expect((await fetch(`${base}/api/proyectos/${id}/render`, { method: "POST" })).status).toBe(503);
  });
});

describe("Cloudflare", () => {
  const pedido = async () => ({ referencia: await png(100, 50), width: 1024, height: 512 });
  const respuesta = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

  it("envía el formato documentado", async () => {
    const falsa = vi.fn(async () => respuesta({ success: true, result: { image: Buffer.from("hola").toString("base64") } }));
    const proveedor = crearCloudflare({ cuenta: "abc", token: "tk", fetch: falsa as unknown as typeof fetch });
    expect((await proveedor.generar(await pedido())).toString()).toBe("hola");

    const [url, opciones] = falsa.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/abc/ai/run/@cf/black-forest-labs/flux-2-dev");
    expect(opciones.headers).toEqual({ Authorization: "Bearer tk" });
    const form = opciones.body as FormData;
    expect(form.get("input_image_0")).toBeInstanceOf(Blob);
    expect(form.get("width")).toBe("1024");
    expect(form.get("prompt")).toMatch(/floor plan/);
  });

  it.each([
    [401, /credenciales/],
    [403, /credenciales/],
    [429, /límite/i],
    [500, /no pudo generar/],
  ])("explica el error %i sin mostrar el token", async (status, mensaje) => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const falsa = vi.fn(async () => respuesta({ errors: [] }, status));
    const proveedor = crearCloudflare({ cuenta: "abc", token: "secreto", fetch: falsa as unknown as typeof fetch });
    const error = await proveedor.generar(await pedido()).catch((e: Error) => e);
    expect((error as Error).message).toMatch(mensaje);
    expect((error as Error).message).not.toContain("secreto");
    consola.mockRestore();
  });

  it("falla con claridad si la respuesta no trae imagen o no hay conexión", async () => {
    const vacia = crearCloudflare({ cuenta: "a", token: "t", fetch: (async () => respuesta({ result: {} })) as unknown as typeof fetch });
    await expect(vacia.generar(await pedido())).rejects.toThrow(/no incluía/);
    const caida = crearCloudflare({ cuenta: "a", token: "t", fetch: (async () => { throw new Error("red"); }) as unknown as typeof fetch });
    await expect(caida.generar(await pedido())).rejects.toThrow(/conectar/);
  });
});
