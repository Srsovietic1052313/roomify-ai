import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearAjustes, type Cifrador } from "../desktop/ajustes.ts";

const cifrador: Cifrador = {
  isEncryptionAvailable: () => true,
  encryptString: (t) => Buffer.from(t).reverse(),
  decryptString: (d) => Buffer.from(d).reverse().toString(),
};

describe("ajustes guardados", () => {
  let carpeta: string;
  let ruta: string;
  beforeEach(() => {
    carpeta = mkdtempSync(path.join(os.tmpdir(), "ajustes-"));
    ruta = path.join(carpeta, "sub", "ajustes.json");
  });
  afterEach(() => rmSync(carpeta, { recursive: true, force: true }));

  it("no guarda el token en texto plano", () => {
    crearAjustes(ruta, cifrador).guardar({ cuenta: "abc", token: "miclave", demo: false });
    expect(readFileSync(ruta, "utf8")).not.toContain("miclave");
    expect(crearAjustes(ruta, cifrador).token()).toBe("miclave");
  });

  it("conserva el token si no se escribe otro", () => {
    const a = crearAjustes(ruta, cifrador);
    a.guardar({ cuenta: "abc", token: "miclave", demo: false });
    a.guardar({ cuenta: "def", demo: true });
    expect(a.token()).toBe("miclave");
    expect(a.leer()).toEqual({ cuenta: "def", tokenGuardado: true, demo: true });
  });

  it("no guarda el token si Windows no puede cifrarlo", () => {
    const a = crearAjustes(ruta, { ...cifrador, isEncryptionAvailable: () => false });
    expect(() => a.guardar({ cuenta: "abc", token: "x", demo: false })).toThrow(/cifrar/);
  });

  it("tolera un archivo dañado o un token que no se puede descifrar", () => {
    const a = crearAjustes(ruta, cifrador);
    expect(a.leer()).toEqual({ cuenta: "", tokenGuardado: false, demo: false });
    a.guardar({ cuenta: "abc", token: "x", demo: false });
    const roto = crearAjustes(ruta, { ...cifrador, decryptString: () => { throw new Error("no"); } });
    expect(roto.token()).toBe("");
  });
});
