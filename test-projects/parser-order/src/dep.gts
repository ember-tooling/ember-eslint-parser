export class Dep {
  greet(): string {
    return 'hello';
  }

  <template>
    <span>{{this.greet}}</span>
  </template>
}
