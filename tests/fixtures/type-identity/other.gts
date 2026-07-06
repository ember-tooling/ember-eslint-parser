import Priv from './priv';

export default class Other {
  prop: Priv | null = null;
  <template>{{this.prop}}</template>
}
