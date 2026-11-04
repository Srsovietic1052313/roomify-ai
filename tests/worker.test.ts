import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

type Manejador = (c: Record<string, unknown>) => Promise<Response>;
const rutas: Record<string, Manejador> = {};
const kv = new Map<string, Record<string, unknown>>();

const router = {
  get: (r: string, h: Manejador) => { rutas[`GET ${r}`] = h; },
  post: (r: string, h: Manejador) => { rutas[`POST ${r}`] = h; },
  delete: (r: string, h: Manejador) => { rutas[`DELETE ${r}`] = h; },
};
const me = {
  puter: {
    kv: {
      get: async (k: string) => kv.get(k) ?? null,
      set: async (k: string, v: Record<string, unknown>) => { kv.set(k, v); return true; },
      del: async (k: string) => kv.delete(k),
      list: async () => [...kv].map(([key, value]) => ({ key, value })),
    },
  },
};
new Function("router", "me", readFileSync("worker/roomify.worker.js", "utf8"))(router, me);

const usuario = (uuid: string) => ({ puter: { auth: { getUser: async () => ({ uuid, username: uuid }) } } });
const pedido = (cuerpo: unknown) => new Request("https://w/api/feed", { method: "POST", body: JSON.stringify(cuerpo) });
const valido = {
  id: "abc",
  nombre: "Casa",
  plantaUrl: "https://roomify-a.puter.site/a.png",
  renderUrl: "https://roomify-a.puter.site/b.png",
};

describe("worker del feed", () => {
  beforeEach(() => kv.clear());

  it("exige sesión para publicar", async () => {
    const r = await rutas["POST /api/feed"]({ request: pedido(valido) });
    expect(r.status).toBe(401);
  });

  it("rechaza URLs que no son de puter.site", async () => {
    const r = await rutas["POST /api/feed"]({
      request: pedido({ ...valido, renderUrl: "javascript:alert(1)" }),
      user: usuario("u1"),
    });
    expect(r.status).toBe(400);
    expect(kv.size).toBe(0);
  });

  it("toma el autor de la sesión y no expone su id", async () => {
    await rutas["POST /api/feed"]({
      request: pedido({ ...valido, autor: "suplantado" }),
      user: usuario("u1"),
    });
    const lista = await (await rutas["GET /api/feed"]({})).json();
    expect(lista[0].autor).toBe("u1");
    expect(lista[0].autorId).toBeUndefined();
  });

  it("solo el autor puede cambiar o borrar", async () => {
    await rutas["POST /api/feed"]({ request: pedido(valido), user: usuario("u1") });
    const cambio = await rutas["POST /api/feed"]({ request: pedido(valido), user: usuario("u2") });
    const borrado = await rutas["DELETE /api/feed/:id"]({ params: { id: "abc" }, user: usuario("u2") });
    expect([cambio.status, borrado.status]).toEqual([403, 403]);
    expect(kv.size).toBe(1);
    await rutas["DELETE /api/feed/:id"]({ params: { id: "abc" }, user: usuario("u1") });
    expect(kv.size).toBe(0);
  });
});
