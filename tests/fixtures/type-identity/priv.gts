export default class Priv {
  #secret = 1;
  get val(): number {
    return this.#secret;
  }
  <template>{{this.val}}</template>
}
