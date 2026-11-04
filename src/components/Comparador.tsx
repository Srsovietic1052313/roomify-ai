import { useState } from "react";

interface Props {
  antes: string;
  despues: string;
}

/** Dos imágenes superpuestas: el control deslizante recorta la de arriba. */
export function Comparador({ antes, despues }: Props) {
  const [posicion, setPosicion] = useState(50);
  return (
    <div className="comparador">
      <img src={despues} alt="Render 3D" />
      <img
        src={antes}
        alt="Plano original"
        className="encima-img"
        style={{ clipPath: `inset(0 ${100 - posicion}% 0 0)` }}
      />
      <div className="linea" style={{ left: `${posicion}%` }} />
      <input
        type="range"
        min={0}
        max={100}
        value={posicion}
        aria-label="Comparar plano y render"
        onChange={(e) => setPosicion(Number(e.target.value))}
      />
    </div>
  );
}
