// From @embroider/addon-blueprint
import qp from 'limber/helpers/qp';
import highlighted from 'limber/modifiers/highlighted';
import { service } from 'limber-ui';

const orGlimdown = (format) => format || 'glimdown';

export const Placeholder = <template>
  {{#let (service "editor") as |context|}}
    <label class="sr-only" for="initial-editor">
      Glimmer + Markdown Code Editor
    </label>

    <pre
      data-test-placeholder
      id="initial-editor"
      spellcheck="false"
      class="w-full h-full px-6 py-2 font-sm font-mono text-white"
      {{! @glint-ignore }}
      {{highlighted context.text}}
      ...attributes
    ><code class="{{orGlimdown (qp 'format')}} hljs">{{context.text}}</code></pre>
  {{/let}}
</template>;
