import type { ServiceResponse } from './typed-service.gjs';

// Simple test to see if we can use the discriminated union
function testDiscriminatedUnion(): void {
  const response: ServiceResponse<string> = {
    success: true,
    data: "test"
  };
  
  if (response.success) {
    // This should be fine - TypeScript should narrow the type
    console.log(response.data);
  }
}

export { testDiscriminatedUnion };
