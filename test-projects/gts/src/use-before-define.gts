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

export default Tree;
