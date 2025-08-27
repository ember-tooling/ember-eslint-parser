import type { ServiceResponse } from './typed-service.gjs';

// Test what TypeScript actually thinks the type is
function debugType(): void {
  const response: ServiceResponse<string> = {} as any;
  
  // Let's see what properties TypeScript thinks are available
  // @ts-expect-error - intentional error to see what TS thinks
  const keys = Object.keys(response);
  console.log(keys);
}

export { debugType };
