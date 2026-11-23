import { tracked } from '@glimmer/tracking';

export class State {
  @tracked value = 1;
}

export const extra = 1;
export const unusedHelper = 2;
