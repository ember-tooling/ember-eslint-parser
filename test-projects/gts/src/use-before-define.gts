import Component from '@glimmer/component';

import type { TOC } from '@ember/component/template-only';

interface TreeNode {
  label: string;
  child?: TreeNode;
}

const Tree: TOC<{ Args: { node: TreeNode } }> = <template>
  {{#let @node.label as |label|}}
    <span>{{label}}</span>
  {{/let}}
  {{#if @node.child}}
    <Tree @node={{@node.child}} />
  {{/if}}
</template>;

export class Branch extends Component<{ Args: { node: TreeNode } }> {
  get label() {
    return this.args.node.label;
  }

  <template>
    <span>{{this.label}}</span>
    {{#if @node.child}}
      <Branch @node={{@node.child}} />
    {{/if}}
  </template>
}

export default Tree;
