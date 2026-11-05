import path from "node:path";
import type { AddressInfo } from "node:net";
import { app as electron, BrowserWindow, Menu, safeStorage, shell } from "electron";
import { crearApp } from "../server/app.ts";
import { abrirBase, crearRepositorio } from "../server/db.ts";
import { crearCloudflare, crearSimulado } from "../server/ia.ts";
import { crearAjustes } from "./ajustes.ts";

let ventana: BrowserWindow | null = null;

function arrancarServidor(): Promise<number> {
  const datos = electron.getPath("userData");
  const ajustes = crearAjustes(path.join(datos, "ajustes.json"), safeStorage);
  const simulado = crearSimulado();

  const servidor = crearApp({
    repositorio: crearRepositorio(abrirBase(path.join(datos, "roomify.db"))),
    carpetaImagenes: path.join(datos, "imagenes"),
    carpetaWeb: path.join(electron.getAppPath(), "dist"),
    ajustes,
    // Se crea en cada uso para aplicar los ajustes sin reiniciar la app.
    obtenerIa: () =>
      ajustes.demo()
        ? simulado
        : crearCloudflare({ cuenta: ajustes.cuenta(), token: ajustes.token() }),
  });

  return new Promise((resolver, rechazar) => {
    // Puerto 0: Windows elige uno libre. 127.0.0.1: solo esta computadora puede conectarse.
    const escucha = servidor.listen(0, "127.0.0.1", () => resolver((escucha.address() as AddressInfo).port));
    escucha.on("error", rechazar);
  });
}

async function crearVentana() {
  const puerto = await arrancarServidor();
  const inicio = `http://127.0.0.1:${puerto}`;
  Menu.setApplicationMenu(null);

  ventana = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 640,
    minHeight: 500,
    title: "Roomify",
    icon: path.join(electron.getAppPath(), "recursos", "icono.ico"),
    backgroundColor: "#191816",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  ventana.on("page-title-updated", (evento) => evento.preventDefault());

  // Los enlaces externos se abren en tu navegador, nunca dentro de la app.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  ventana.webContents.on("will-navigate", (evento, url) => {
    if (!url.startsWith(inicio)) evento.preventDefault();
  });
  ventana.on("closed", () => { ventana = null; });
  await ventana.loadURL(inicio);
}

if (!electron.requestSingleInstanceLock()) {
  electron.quit();
} else {
  electron.on("second-instance", () => {
    ventana?.show();
    ventana?.focus();
  });
  electron.on("window-all-closed", () => electron.quit());
  electron.whenReady().then(crearVentana).catch((error) => {
    console.error(error);
    electron.exit(1);
  });
}
