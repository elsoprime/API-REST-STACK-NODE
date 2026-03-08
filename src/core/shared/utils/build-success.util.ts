export interface SuccessResponse<TData> {
  success: true;
  data: TData;
  traceId: string;
}

export interface PaginationInput {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedSuccessResponse<TData> extends SuccessResponse<TData> {
  pagination: PaginationInput & {
    totalPages: number;
  };
}

export function buildSuccess<TData>(data: TData, traceId: string): SuccessResponse<TData> {
  return {
    success: true,
    data,
    traceId
  };
}

export function buildPaginatedSuccess<TData>(
  data: TData,
  pagination: PaginationInput,
  traceId: string
): PaginatedSuccessResponse<TData> {
  const totalPages = pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0;

  return {
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages
    },
    traceId
  };
}
