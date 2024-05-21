import Item from 'a';

export const DomainAliases = <template>
    <Item>
        {{#each @items as |unused domain|}}
            {{domain}}
        {{/each}}
    </Item>
</template>
