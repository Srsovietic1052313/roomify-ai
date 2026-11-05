export interface Proyecto {
  id: string;
  nombre: string;
  creadoEn: string;
  plantaUrl: string;
  renderUrl: string | null;
}

export interface EstadoIa {
  proveedor: "cloudflare" | "simulado";
  configurado: boolean;
  escritorio: boolean;
}

export interface Ajustes {
  cuenta: string;
  tokenGuardado: boolean;
  demo: boolean;
}
