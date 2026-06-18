/**
 * Error types for Mental Health Wallet MVP.
 * Covers all error categories defined in the design document.
 */

export enum ErrorCode {
  // Validation errors
  VALIDATION_EMPTY_FIELD = 'VALIDATION_EMPTY_FIELD',
  VALIDATION_MAX_LENGTH_EXCEEDED = 'VALIDATION_MAX_LENGTH_EXCEEDED',
  VALIDATION_INVALID_URL = 'VALIDATION_INVALID_URL',
  VALIDATION_INVALID_IMAGE = 'VALIDATION_INVALID_IMAGE',
  VALIDATION_CONTROLS_COUNT = 'VALIDATION_CONTROLS_COUNT',
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',

  // Persistence errors
  PERSISTENCE_WRITE_FAILED = 'PERSISTENCE_WRITE_FAILED',
  PERSISTENCE_READ_FAILED = 'PERSISTENCE_READ_FAILED',
  PERSISTENCE_TRANSACTION_FAILED = 'PERSISTENCE_TRANSACTION_FAILED',
  PERSISTENCE_DISK_FULL = 'PERSISTENCE_DISK_FULL',
  PERSISTENCE_NOT_FOUND = 'PERSISTENCE_NOT_FOUND',

  // Notification errors
  NOTIFICATION_PERMISSION_DENIED = 'NOTIFICATION_PERMISSION_DENIED',
  NOTIFICATION_SCHEDULE_FAILED = 'NOTIFICATION_SCHEDULE_FAILED',
  NOTIFICATION_CANCEL_FAILED = 'NOTIFICATION_CANCEL_FAILED',

  // Deep link errors
  DEEP_LINK_APP_NOT_INSTALLED = 'DEEP_LINK_APP_NOT_INSTALLED',
  DEEP_LINK_MALFORMED_URL = 'DEEP_LINK_MALFORMED_URL',
  DEEP_LINK_OPEN_FAILED = 'DEEP_LINK_OPEN_FAILED',
  DEEP_LINK_NO_FALLBACK = 'DEEP_LINK_NO_FALLBACK',

  // Image errors
  IMAGE_CAMERA_DENIED = 'IMAGE_CAMERA_DENIED',
  IMAGE_FILE_TOO_LARGE = 'IMAGE_FILE_TOO_LARGE',
  IMAGE_RESOLUTION_TOO_LOW = 'IMAGE_RESOLUTION_TOO_LOW',
  IMAGE_INVALID_FORMAT = 'IMAGE_INVALID_FORMAT',
  IMAGE_CORRUPT_FILE = 'IMAGE_CORRUPT_FILE',

  // Export errors
  EXPORT_FILE_SYSTEM_ERROR = 'EXPORT_FILE_SYSTEM_ERROR',
  EXPORT_GENERATION_FAILED = 'EXPORT_GENERATION_FAILED',
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly isRetryable: boolean;
  public readonly context?: Record<string, unknown>;

  public readonly cause?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      isRetryable?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.isRetryable = options?.isRetryable ?? false;
    this.context = options?.context;
    this.cause = options?.cause;
  }

  /** Create a validation error. */
  static validation(code: ErrorCode, message: string, field?: string): AppError {
    return new AppError(code, message, {
      isRetryable: false,
      context: field ? { field } : undefined,
    });
  }

  /** Create a persistence error. */
  static persistence(code: ErrorCode, message: string, cause?: Error): AppError {
    return new AppError(code, message, {
      isRetryable: true,
      cause,
    });
  }

  /** Create a notification error. */
  static notification(code: ErrorCode, message: string): AppError {
    return new AppError(code, message, {
      isRetryable: false,
    });
  }

  /** Create a deep link error. */
  static deepLink(code: ErrorCode, message: string, url?: string): AppError {
    return new AppError(code, message, {
      isRetryable: false,
      context: url ? { url } : undefined,
    });
  }

  /** Create an image error. */
  static image(code: ErrorCode, message: string, context?: Record<string, unknown>): AppError {
    return new AppError(code, message, {
      isRetryable: false,
      context,
    });
  }

  /** Create an export error. */
  static export(code: ErrorCode, message: string, cause?: Error): AppError {
    return new AppError(code, message, {
      isRetryable: true,
      cause,
    });
  }
}
