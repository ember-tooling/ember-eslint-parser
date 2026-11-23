import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { unusedHelper } from './helpers.js';

export default class Counter extends Component {
  @tracked count = 0;

  increment = () => {
    this.count++;
  };

  loadExtra = async () => {
    const { extra } = await import('./helpers.js');
    return extra;
  };

  <template>
    <button type="button" {{on "click" this.increment}}>{{this.count}}</button>
    <NotDefined />
    {{notDefinedEither}}
  </template>
}
