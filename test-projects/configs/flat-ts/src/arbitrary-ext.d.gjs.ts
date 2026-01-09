// Type declarations for arbitrary extension pattern (.d.gjs.ts)
export interface ArbitraryConfig {
  id: string;
  enabled: boolean;
}

export type ArbitraryResponse<T = unknown> = 
  | {
      success: true;
      result: T;
    }
  | {
      success: false;
      error: string;
    };

export declare class ArbitraryService {
  process<T>(data: T): ArbitraryResponse<T>;
}
