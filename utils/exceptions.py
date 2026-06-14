from __future__ import annotations


class AppError(Exception):
    """Base for all application-level errors. Caught by the global handler."""
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred"

    def __init__(self, message: str | None = None, detail: object = None) -> None:
        self.message = message or self.__class__.message
        self.detail = detail
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    error_code = "NOT_FOUND"
    message = "Resource not found"


class ConflictError(AppError):
    status_code = 409
    error_code = "CONFLICT"
    message = "Resource already exists"


class ForbiddenError(AppError):
    status_code = 403
    error_code = "FORBIDDEN"
    message = "Access denied"


class UnauthorizedError(AppError):
    status_code = 401
    error_code = "UNAUTHORIZED"
    message = "Authentication required"


class ValidationError(AppError):
    status_code = 422
    error_code = "VALIDATION_ERROR"
    message = "Validation failed"


class ExternalServiceError(AppError):
    status_code = 502
    error_code = "EXTERNAL_SERVICE_ERROR"
    message = "An external service failed"
