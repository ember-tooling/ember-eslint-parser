import type { ServiceResponse } from './typed-service.gjs';

// Test what TypeScript actually thinks the type is
function debugType(): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  const response: ServiceResponse<string> = {} as any;
  
  // Let's see what properties TypeScript thinks are available
  const keys = Object.keys(response);
  console.log(keys);
}

export { debugType };
