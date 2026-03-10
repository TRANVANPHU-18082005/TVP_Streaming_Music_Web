class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  errorCode?: string; // Thêm cái này để Frontend xử lý (VD: ACCOUNT_LOCKED)

  constructor(
    statusCode: number,
    message: string,
    errorCode?: string, // Optional param
    isOperational = true,
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
