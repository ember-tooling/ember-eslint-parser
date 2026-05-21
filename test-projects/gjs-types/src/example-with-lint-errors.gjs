export function exampleWithLintErrors() {
  // Should trigger no-constant-condition
  if (false) {
    return 1;
  }

  return 0;
}
