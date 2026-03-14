/**
 * Recursively find the first AST node of the given type.
 *
 * @param {object} node - Root node to search from
 * @param {string} type - Node type to search for
 * @param {Set} [visited] - Set of already-visited nodes (cycle guard)
 * @returns {object|null} The first matching node, or null
 */
export function findNode(node, type, visited = new Set()) {
  if (!node || typeof node !== 'object' || visited.has(node)) return null;
  visited.add(node);
  if (node.type === type) return node;
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        const found = findNode(item, type, visited);
        if (found) return found;
      }
    } else if (val && typeof val === 'object') {
      const found = findNode(val, type, visited);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively collect all AST nodes of the given type.
 *
 * @param {object} node - Root node to search from
 * @param {string} type - Node type to collect
 * @param {Set} [visited] - Set of already-visited nodes (cycle guard)
 * @param {Array} [results] - Accumulator array
 * @returns {Array} All matching nodes
 */
export function findAllNodes(node, type, visited = new Set(), results = []) {
  if (!node || typeof node !== 'object' || visited.has(node)) return results;
  visited.add(node);
  if (node.type === type) results.push(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        findAllNodes(item, type, visited, results);
      }
    } else if (val && typeof val === 'object') {
      findAllNodes(val, type, visited, results);
    }
  }
  return results;
}
