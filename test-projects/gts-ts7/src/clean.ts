import { loadCount } from './loader.gts';

export async function total(): Promise<number> {
  return (await loadCount()) + 1;
}
