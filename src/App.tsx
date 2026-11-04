import { Link, Route, Routes } from "react-router-dom";
import { useApp } from "./contexto";
import { Inicio } from "./pages/Inicio";
import { PaginaProyecto } from "./pages/PaginaProyecto";

export function App() {
  const { usuario, entrar, salir, error, cargando } = useApp();
  return (
    <>
      <header className="barra">
        <Link to="/" className="marca">Roomify</Link>
        {!cargando &&
          (usuario ? (
            <div className="sesion">
              <span>{usuario.username}</span>
              <button className="secundario" onClick={salir}>Salir</button>
            </div>
          ) : (
            <button onClick={entrar}>Iniciar sesión</button>
          ))}
      </header>
      {error && <p className="error contenido" role="alert">{error}</p>}
      <main className="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/proyecto/:id" element={<PaginaProyecto />} />
          <Route path="*" element={<p>Esta página no existe. <Link to="/">Volver al inicio</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
