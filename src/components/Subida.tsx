import { useRef, useState, type DragEvent } from "react";
import { TIPOS_PERMITIDOS } from "../lib/proyectos";

interface Props {
  ocupado: boolean;
  alElegir: (archivo: File) => void;
}

export function Subida({ ocupado, alElegir }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  const soltar = (evento: DragEvent) => {
    evento.preventDefault();
    setEncima(false);
    const archivo = evento.dataTransfer.files[0];
    if (archivo && !ocupado) alElegir(archivo);
  };

  return (
    <div
      className={`subida ${encima ? "encima" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
    >
      <p><strong>Arrastra aquí tu plano</strong></p>
      <p className="tenue">PNG, JPG o WEBP, hasta 10 MB</p>
      <button disabled={ocupado} onClick={() => entrada.current?.click()}>
        {ocupado ? "Subiendo…" : "Elegir archivo"}
      </button>
      <input
        ref={entrada}
        type="file"
        hidden
        accept={TIPOS_PERMITIDOS.join(",")}
        aria-label="Plano"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) alElegir(archivo);
          e.target.value = ""; // permite volver a elegir el mismo archivo
        }}
      />
    </div>
  );
}
