// This is a .gjs file with runtime implementation
export class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  
  async get(path) {
    const response = await fetch(`${this.baseUrl}${path}`);
    return response.json();
  }
}

export const DefaultClient = <template>
  <div>Default API Client Component</div>
</template>;
