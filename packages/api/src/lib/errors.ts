export class AppError extends Error {
  public data?: Record<string, any>;
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    data?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AppError';
    this.data = data;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, data?: Record<string, any>) {
    super(400, message, 'BAD_REQUEST', data);
  }
}
