import type { ApiResponse } from './api-service.gjs';
import { DataService, ApiComponent } from './api-service.gjs';

// Test that we can use the imported type
async function processApiData(): Promise<ApiResponse> {
  const service = new DataService();
  return await service.fetchData();
}

// Test that we can reference the imported component
const component = ApiComponent;

// This should trigger a type error if types aren't resolved
// because we're trying to assign a number to a string property
const badApiResponse: ApiResponse = {
  status: 200,
  data: { message: 'test' },
  message: 123 // This should be a string, not a number
};

export { processApiData, component, badApiResponse };
