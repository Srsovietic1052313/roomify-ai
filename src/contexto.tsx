import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { obtenerPuter } from "./lib/puter";
import { crearServicio, type ServicioProyectos } from "./lib/proyectos";
import type { PuterApi, Usuario } from "./lib/tipos";

interface EstadoApp {
  cargando: boolean;
  error: string | null;
  usuario: Usuario | null;
  servicio: ServicioProyectos | null;
  entrar: () => Promise<void>;
  salir: () => Promise<void>;
}

const Contexto = createContext<EstadoApp | null>(null);

export function ProveedorApp({ children }: { children: ReactNode }) {
  const [puter, setPuter] = useState<PuterApi | null>(null);
  const [servicio, setServicio] = useState<ServicioProyectos | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const api = await obtenerPuter();
        setPuter(api);
        setServicio(
          crearServicio(api, {
            simulado: import.meta.env.VITE_PUTER_MOCK === "true",
            urlWorker: import.meta.env.VITE_PUTER_WORKER_URL ?? "",
          }),
        );
        if (api.auth.isSignedIn()) setUsuario(await api.auth.getUser());
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo iniciar la app.");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // signIn abre una ventana emergente: debe llamarse directamente desde un clic.
  const entrar = useCallback(async () => {
    if (!puter) return;
    setError(null);
    try {
      await puter.auth.signIn();
      setUsuario(await puter.auth.getUser());
    } catch {
      setError("No se pudo iniciar sesión. Permite las ventanas emergentes e inténtalo de nuevo.");
    }
  }, [puter]);

  const salir = useCallback(async () => {
    await puter?.auth.signOut();
    setUsuario(null);
  }, [puter]);

  return (
    <Contexto.Provider value={{ cargando, error, usuario, servicio, entrar, salir }}>
      {children}
    </Contexto.Provider>
  );
}

export function useApp() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useApp debe usarse dentro de ProveedorApp");
  return valor;
}
