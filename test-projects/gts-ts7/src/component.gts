import { loadCount } from './loader.gts';

export function refresh(): void {
  loadCount();
}

export const Refresh = <template>refresh</template>;
