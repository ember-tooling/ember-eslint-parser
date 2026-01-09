export interface ApiResponse {
  status: number;
  data: unknown;
  message: string;
}

export class DataService {
  apiUrl = 'https://api.example.com';
  
  async fetchData(): Promise<ApiResponse> {
    const response = await fetch(this.apiUrl);
    return {
      status: response.status,
      data: await response.json(),
      message: response.statusText
    };
  }
}

export const ApiComponent = <template>
  <div>API Component</div>
</template>;
