export interface UserData {
  id: number;
  name: string;
  email: string;
}

export class UserService {
  users = [];
  
  addUser(user) {
    this.users.push(user);
  }
}

export const ExampleComponent = <template>
  <div>Hello from GJS component</div>
</template>;
