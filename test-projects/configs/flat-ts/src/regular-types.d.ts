// Test with regular .d.ts file
export interface ServiceConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
}

export type ServiceResponse<T = unknown> = 
  | {
      success: true;
      data: T;
      error?: undefined;
    }
  | {
      success: false;
      data?: undefined;
      error: string;
    };

export declare class TypedService {
  constructor(config: ServiceConfig);
  config: ServiceConfig;
  request<T = unknown>(path: string): Promise<ServiceResponse<T>>;
  isConnected(): boolean;
}
