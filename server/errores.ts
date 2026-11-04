/** Error con un mensaje seguro de mostrar al usuario. */
export class ErrorApi extends Error {
  status: number;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}
