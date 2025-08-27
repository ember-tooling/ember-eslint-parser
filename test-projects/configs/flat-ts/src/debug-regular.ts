import type { ServiceResponse } from './regular-types';

// Simple test to see if we can use the discriminated union from regular .d.ts
function testRegularDiscriminatedUnion(): void {
  const response: ServiceResponse<string> = {
    success: true,
    data: "test"
  };
  
  if (response.success) {
    // This should be fine - TypeScript should narrow the type
    console.log(response.data);
  }
}

export { testRegularDiscriminatedUnion };
