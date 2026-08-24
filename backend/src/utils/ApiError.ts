class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  errorCode?: string; // Thêm cái này để Frontend xử lý (VD: ACCOUNT_LOCKED)
  errors?: any[]; // Chi tiết lỗi, đặc biệt hữu ích cho validation (Zod)
  data?: any; // Custom data (VD: danh sách providers khi LOGIN_METHOD_REQUIRED)

  constructor(
    statusCode: number,
    message: string,
    errorCode?: string, // Optional param
    isOperational = true,
    stack = "",
    errors?: any[], // Optional param
    data?: any // Optional param
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    if (errors) {
      this.errors = errors;
    }
    if (data) {
      this.data = data;
    }

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
