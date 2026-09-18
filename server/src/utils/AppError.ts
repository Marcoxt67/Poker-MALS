export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }

  static badRequest(message: string, code = "BAD_REQUEST") {
    return new AppError(message, 400, code);
  }

  static unauthorized(message = "Não autenticado.") {
    return new AppError(message, 401, "UNAUTHORIZED");
  }

  static forbidden(message = "Você não possui permissão para executar esta ação.") {
    return new AppError(message, 403, "FORBIDDEN");
  }

  static notFound(message = "Recurso não encontrado.") {
    return new AppError(message, 404, "NOT_FOUND");
  }

  static conflict(message: string) {
    return new AppError(message, 409, "CONFLICT");
  }
}
