import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { isDestroyed, isDestroying } from '@ember/destroyable';
import { waitForPromise } from '@ember/test-waiters';

import type { ComponentLike } from '@glint/template';

export class DeconstructArray extends Component<unknown> {
  testFunction = async () => {
    const [, ...remaining] = await Promise.all([1, 2, 3]);
  }

  <template>
    This is a template
  </template>
}
