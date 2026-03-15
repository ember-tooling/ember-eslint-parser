#!/usr/bin/env bash


BENCH_OUTPUT_FILE=./bench-output.txt
BENCH_JSON_OUTPUT=./bench-results.json

pnpm bench:compare | sed 's/\x1b\[[0-9;]*m//g' > ./bench-output.txt
node scripts/format-bench-comment.mjs > ./bench-comment.md

cat ./bench-comment.md
