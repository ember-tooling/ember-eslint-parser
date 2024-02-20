import { hi } from './await.gts';
import type { Other } from './await.gts';

console.log(hi());

const x: Other = '' as unknown as Other;

export { x };
