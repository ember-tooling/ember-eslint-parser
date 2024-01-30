import Component from '@glimmer/component';

export class DeconstructArray extends Component {
  testFunction = async () => {
    const [, ...remaining] = await Promise.all([1, 2, 3]);
    return remaining;
  }

  <template>
    This is a template
  </template>
}
