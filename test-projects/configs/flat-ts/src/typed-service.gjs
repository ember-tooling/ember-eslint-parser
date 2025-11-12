// Runtime implementation for typed-service.gjs
export class TypedService {
  constructor(config) {
    this.config = config;
  }
  
  async request(path) {
    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        timeout: this.config.timeout || 5000,
      });
      
      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
  
  isConnected() {
    return Boolean(this.config.apiKey && this.config.baseUrl);
  }
}

export const ServiceComponent = <template>
  <div class="service-status">
    {{#if this.isConnected}}
      Connected to {{this.config.baseUrl}}
    {{else}}
      Not connected
    {{/if}}
  </div>
</template>;
