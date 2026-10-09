export async function load(store, Fallback = <template>Loading</template>) {
  const Greeting = <template>Hello</template>;
  let Farewell;
  Farewell = <template>Bye</template>;
  Farewell ??= <template>Later</template>;
  await store.ready();
  return [Fallback, Greeting, Farewell];
}
