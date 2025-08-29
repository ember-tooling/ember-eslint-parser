import type { ArbitraryConfig, ArbitraryResponse } from './arbitrary-ext.gjs';
import { ArbitraryService } from './arbitrary-ext.gjs';

// Test that TypeScript can resolve types from .d.gjs.ts files
function testArbitraryExtensions(): void {
  const config: ArbitraryConfig = {
    id: 'test',
    enabled: true
  };

  const service = new ArbitraryService();
  const response: ArbitraryResponse<string> = service.process('hello');
  
  if (response.success) {
    // TypeScript should know that response.result is a string when success is true
    console.log(response.result.toUpperCase());
  } else {
    console.error(response.error);
  }
  
  // Use the config to avoid unused variable warning
  console.log('Config ID:', config.id);
}

export { testArbitraryExtensions };
