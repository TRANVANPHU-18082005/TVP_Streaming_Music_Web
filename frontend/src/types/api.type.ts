export interface ApiResponse<T> {
  isSuccess: boolean;
  message: string;
  data: T; // T ở đây sẽ là AuthDto
  errors: string[] | null;
}

export interface ApiErrorResponse {
  response?: {
    data?: {
      code: number; // HTTP status code
      errors?: Array<{ field: string; message: string }>;
      success: boolean;
      message: string;
      errorCode?: string; // VD: 'UNVERIFIED_ACCOUNT'
      stack?: string; // Chỉ có trong môi trường dev
    };
  };
}

export interface PagedResponse<T> {
  data: T[];
  meta: {
    totalItems: number;
    page: number;
    pageSize?: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}
