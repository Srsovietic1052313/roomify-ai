import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Ajustes, DatosAjustes } from "../server/app.ts";

export interface Cifrador {
  isEncryptionAvailable(): boolean;
  encryptString(texto: string): Buffer;
  decryptString(datos: Buffer): string;
}

interface Archivo {
  cuenta: string;
  tokenCifrado: string;
  demo: boolean;
}

/** Guarda los ajustes en disco. El token solo se escribe cifrado por Windows para tu usuario. */
export function crearAjustes(ruta: string, cifrador: Cifrador): Ajustes & { token(): string; demo(): boolean; cuenta(): string } {
  const vacio: Archivo = { cuenta: "", tokenCifrado: "", demo: false };
  const leerArchivo = (): Archivo => {
    if (!existsSync(ruta)) return vacio;
    try {
      return { ...vacio, ...JSON.parse(readFileSync(ruta, "utf8")) };
    } catch {
      return vacio;
    }
  };

  return {
    leer() {
      const a = leerArchivo();
      return { cuenta: a.cuenta, tokenGuardado: Boolean(a.tokenCifrado), demo: a.demo };
    },
    guardar({ cuenta, token, demo }: DatosAjustes) {
      const a = leerArchivo();
      let tokenCifrado = a.tokenCifrado;
      if (token) {
        if (!cifrador.isEncryptionAvailable()) throw new Error("Windows no pudo cifrar el token.");
        tokenCifrado = cifrador.encryptString(token).toString("base64");
      }
      mkdirSync(path.dirname(ruta), { recursive: true });
      writeFileSync(ruta, JSON.stringify({ cuenta, tokenCifrado, demo }), { mode: 0o600 });
    },
    token() {
      const { tokenCifrado } = leerArchivo();
      if (!tokenCifrado) return "";
      try {
        return cifrador.decryptString(Buffer.from(tokenCifrado, "base64"));
      } catch {
        return ""; // copiado de otra computadora: habrá que escribirlo otra vez
      }
    },
    demo: () => leerArchivo().demo,
    cuenta: () => leerArchivo().cuenta,
  };
}
