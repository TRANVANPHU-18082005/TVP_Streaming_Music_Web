export interface ApiResponse<T> {
  isSuccess: boolean;
  message: string;
  data: T; // T ở đây sẽ là AuthDto
  errors: string[] | null;
}

export interface ApiErrorResponse {
  response?: {
    data?: {
      success: boolean;
      message: string;
      errorCode?: string; // VD: 'UNVERIFIED_ACCOUNT'
      data?: {
        email?: string; // Trường hợp trả về email khi lỗi
      };
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
