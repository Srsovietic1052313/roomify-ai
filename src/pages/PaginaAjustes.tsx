import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Ajustes } from "../lib/tipos";

export function PaginaAjustes({ alGuardar }: { alGuardar: () => void }) {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [cuenta, setCuenta] = useState("");
  const [token, setToken] = useState("");
  const [demo, setDemo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.leerAjustes()
      .then((datos) => {
        setAjustes(datos);
        setCuenta(datos.cuenta);
        setDemo(datos.demo);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setMensaje(null);
    setError(null);
    try {
      const datos = await api.guardarAjustes({ cuenta, demo, ...(token ? { token } : {}) });
      setAjustes(datos);
      setToken("");
      setMensaje("Ajustes guardados.");
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="ajustes">
      <h1>Ajustes</h1>
      <p className="tenue">
        Para generar renders reales necesitas una cuenta de{" "}
        <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noreferrer">Cloudflare</a>{" "}
        y un API token con permiso de Workers AI. El token se guarda cifrado en esta computadora.
      </p>
      <form onSubmit={guardar}>
        <label>
          Account ID
          <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <label>
          API token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            placeholder={ajustes?.tokenGuardado ? "Ya hay un token guardado. Escribe otro para cambiarlo." : ""}
          />
        </label>
        <label className="casilla">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          Usar modo demo, sin IA ni costos
        </label>
        <button type="submit">Guardar</button>
      </form>
      {mensaje && <p role="status">{mensaje}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
