import type { ApiResponse } from './api-client.gjs';
import { ApiClient, DefaultClient } from './api-client.gjs';

// Test that we can use the imported types from the .gjs.d.ts file
async function testApiClient(): Promise<void> {
  const client = new ApiClient('https://api.example.com');
  
  // This should be properly typed as ApiResponse<any>
  const response = await client.get('/users');
  
  // Test that the response has the correct structure from the .d.ts file
  console.log(`Status: ${response.status}`);
  console.log(`Data:`, response.data);
  if (response.message) {
    console.log(`Message: ${response.message}`);
  }
}

// Test that we can use generics from the .d.ts file
async function testTypedApiClient(): Promise<void> {
  const client = new ApiClient('https://api.example.com');
  
  // This should be properly typed as ApiResponse<{ id: number; name: string }>
  const userResponse = await client.get<{ id: number; name: string }>('/user/1');
  
  // TypeScript should know that userResponse.data has id and name properties
  const userId: number = userResponse.data.id;
  const userName: string = userResponse.data.name;
  
  console.log(`User: ${userName} (ID: ${userId})`);
}

// Test that we can reference the component
const component = DefaultClient;

export { testApiClient, testTypedApiClient, component };
