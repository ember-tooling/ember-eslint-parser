import type { ServiceConfig, ServiceResponse } from './typed-service.gjs';
import { TypedService, ServiceComponent } from './typed-service.gjs';

// Test that we can use the imported types from the .gjs.d.ts file
const config: ServiceConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://api.example.com',
  timeout: 3000
};

async function testTypedService(): Promise<void> {
  const service = new TypedService(config);
  
  // Test that the service is properly typed
  const isConnected: boolean = service.isConnected();
  console.log(`Service connected: ${isConnected}`);
  
  // Test that the generic response typing works
  interface User {
    id: number;
    name: string;
    email: string;
  }
  
  const userResponse: ServiceResponse<User> = await service.request<User>('/user/1');
  
  if (userResponse.success && userResponse.data) {
    // TypeScript should know that userResponse.data is of type User when success is true
    console.log(`User: ${userResponse.data.name} (${userResponse.data.email})`);
  } else if (userResponse.error) {
    console.error(`Error: ${userResponse.error}`);
  }
}

// Test that we can reference the component
const component = ServiceComponent;

export { testTypedService, component, config };
