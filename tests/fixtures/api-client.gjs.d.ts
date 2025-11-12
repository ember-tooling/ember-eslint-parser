// Type declarations for api-client.gjs
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message?: string;
}

export declare class ApiClient {
  constructor(baseUrl: string);
  baseUrl: string;
  get<T = unknown>(path: string): Promise<ApiResponse<T>>;
}

// Component type - this would typically be inferred from the template
export declare const DefaultClient: unknown;
