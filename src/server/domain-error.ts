export class DomainError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 413 | 415 | 503,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
