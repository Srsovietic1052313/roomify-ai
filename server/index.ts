import path from "node:path";
import { crearApp } from "./app.ts";
import { abrirBase, crearRepositorio } from "./db.ts";
import { crearCloudflare, crearSimulado } from "./ia.ts";

const PUERTO = Number(process.env.API_PORT ?? 3001);
const demo = process.argv.includes("--demo");
const datos = path.resolve(demo ? "data/demo" : "data");

const ia = demo
  ? crearSimulado()
  : crearCloudflare({
      cuenta: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
      modelo: process.env.CLOUDFLARE_MODELO || undefined,
    });

const app = crearApp({
  repositorio: crearRepositorio(abrirBase(path.join(datos, "roomify.db"))),
  carpetaImagenes: path.join(datos, "imagenes"),
  obtenerIa: () => ia,
  carpetaWeb: path.resolve("dist"),
});

// 127.0.0.1: solo esta computadora puede conectarse.
app.listen(PUERTO, "127.0.0.1", () => {
  console.log(`Servidor en http://localhost:${PUERTO} | IA: ${ia.nombre}${ia.configurado ? "" : " (sin configurar)"}`);
});
