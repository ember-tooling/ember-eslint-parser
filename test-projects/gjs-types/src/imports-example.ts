import { example } from './example';

// Should not trigger no-unsafe-assignment or no-unsafe-member-access
const value = example.value;

console.log(value); 