import type { UserData } from './types-export.gjs';
import { UserService, ExampleComponent } from './types-export.gjs';

// Test that we can use the imported type
const userData: UserData = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com'
};

// Test that we can use the imported class
const userService = new UserService();
userService.addUser(userData);

// Test that we can reference the imported component
const component = ExampleComponent;

export { userData, userService, component };
