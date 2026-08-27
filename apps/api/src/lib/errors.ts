export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'REQUEST_FAILED',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(message = 'Not found'): HttpError {
  return new HttpError(404, message, 'NOT_FOUND');
}

export function badRequest(message: string, code = 'BAD_REQUEST'): HttpError {
  return new HttpError(400, message, code);
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message, 'CONFLICT');
}
