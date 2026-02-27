import Component from '@glimmer/component';

interface GreeterArgs {
  name: string;
}

export function greet(name: string): string {
  return `Hello, ${name}`;
}

export default class Greeter extends Component<{ Args: GreeterArgs }> {
  get greeting(): string {
    return greet(this.args.name);
  }

  <template>
    <div>{{this.greeting}}</div>
  </template>
}
