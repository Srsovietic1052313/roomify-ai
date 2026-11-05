import { useCallback, useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import type { EstadoIa } from "./lib/tipos";
import { PaginaAjustes } from "./pages/PaginaAjustes";
import { Inicio } from "./pages/Inicio";
import { PaginaProyecto } from "./pages/PaginaProyecto";

export function App() {
  const [estado, setEstado] = useState<EstadoIa | null>(null);

  const actualizarEstado = useCallback(() => {
    api.estado().then(setEstado).catch(() => setEstado(null));
  }, []);

  useEffect(actualizarEstado, [actualizarEstado]);

  return (
    <>
      <header className="barra">
        <Link to="/" className="marca">Roomify</Link>
        {estado?.escritorio && <Link to="/ajustes" className="boton secundario">Ajustes</Link>}
      </header>
      {estado?.proveedor === "simulado" && (
        <p className="aviso">Modo demo: no se usa IA. El «render» es el mismo plano con otro color.</p>
      )}
      {estado?.proveedor === "cloudflare" && !estado.configurado && (
        <p className="aviso">
          Falta configurar Cloudflare para generar renders.{" "}
          {estado.escritorio ? <Link to="/ajustes">Abrir ajustes</Link> : "Sigue los pasos del README."}
        </p>
      )}
      <main className="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/proyecto/:id" element={<PaginaProyecto iaLista={estado?.configurado ?? false} />} />
          <Route path="/ajustes" element={<PaginaAjustes alGuardar={actualizarEstado} />} />
          <Route path="*" element={<p>Esta página no existe. <Link to="/">Volver al inicio</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
