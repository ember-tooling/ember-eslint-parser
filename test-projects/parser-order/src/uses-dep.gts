import { Dep } from './dep.gts';

const dep = new Dep();
export const greeting: string = dep.greet();

<template>
  <div>{{greeting}}</div>
</template>
