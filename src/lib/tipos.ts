export interface Proyecto {
  id: string;
  nombre: string;
  creadoEn: string;
  plantaUrl: string;
  renderUrl: string | null;
  publico: boolean;
}

export interface PublicacionFeed {
  id: string;
  nombre: string;
  plantaUrl: string;
  renderUrl: string;
  autor: string;
  publicadoEn: string;
}

export interface Usuario {
  username: string;
  uuid?: string;
}

/** Solo la parte de Puter.js que usa esta app. */
export interface PuterApi {
  auth: {
    signIn(): Promise<unknown>;
    signOut(): void | Promise<void>;
    isSignedIn(): boolean;
    getUser(): Promise<Usuario>;
  };
  ai: {
    txt2img(prompt: string, opciones: Record<string, unknown>): Promise<HTMLImageElement>;
  };
  kv: {
    set(clave: string, valor: unknown): Promise<boolean>;
    get<T>(clave: string): Promise<T | null>;
    list(patron: string, conValores: true): Promise<{ key: string; value: unknown }[]>;
    del(clave: string): Promise<boolean>;
  };
  fs: {
    write(ruta: string, datos: Blob, opciones?: Record<string, unknown>): Promise<unknown>;
    mkdir(ruta: string, opciones?: Record<string, unknown>): Promise<unknown>;
  };
  hosting: {
    create(subdominio: string, carpeta: string): Promise<{ subdomain: string }>;
  };
  workers: {
    exec(url: string, opciones?: RequestInit): Promise<Response>;
  };
}
