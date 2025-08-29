import { TypedService } from './typed-service.gjs';

// Very simple test - if this compiles without 'any' errors, 
// then TypeScript is finding the .gjs.d.ts file
const service = new TypedService({
  apiKey: 'test',
  baseUrl: 'https://api.example.com'
});

// This should be typed as boolean
const connected: boolean = service.isConnected();

console.log('Service connected:', connected);

// eslint-disable-next-line ember/no-test-import-export
export { service };
