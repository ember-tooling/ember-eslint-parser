import DocumentLines from '../utils/document.js';

/**
 * Extract template spans (those with glimmerAstMapping) from correlatedSpans.
 * @param {Array} correlatedSpans
 * @returns {Array<{ transformedStart: number, transformedEnd: number, originalStart: number, originalEnd: number, span: object }>}
 */
function getTemplateSpans(correlatedSpans) {
  const result = [];
  for (const span of correlatedSpans) {
    if (span.glimmerAstMapping) {
      result.push({
        transformedStart: span.transformedStart,
        transformedEnd: span.transformedStart + span.transformedLength,
        originalStart: span.originalStart,
        originalEnd: span.originalStart + span.originalLength,
        span,
      });
    }
  }
  return result;
}

/**
 * Map a transformed-space offset back to original-space.
 * Returns null if the offset is in the interior of a template span
 * (those nodes will be replaced by Glimmer AST).
 *
 * @param {Array} correlatedSpans
 * @param {Array} templateSpans - precomputed from getTemplateSpans
 * @param {number} transformedOffset
 * @returns {number|null}
 */
function remapOffset(correlatedSpans, templateSpans, transformedOffset) {
  // Check if inside a template span
  for (const tpl of templateSpans) {
    if (transformedOffset === tpl.transformedStart) {
      return tpl.originalStart;
    }
    if (transformedOffset === tpl.transformedEnd) {
      return tpl.originalEnd;
    }
    if (transformedOffset > tpl.transformedStart && transformedOffset < tpl.transformedEnd) {
      return null; // interior of template span
    }
  }

  // Find the enclosing span and apply linear formula.
  // Template spans are included but safe: if we reach here, the offset is not at a
  // template boundary (handled above) and not in the interior (returned null above).
  // For non-template spans, originalLength === transformedLength, so the formula is a
  // simple offset shift.
  for (const span of correlatedSpans) {
    const spanEnd = span.transformedStart + span.transformedLength;
    if (transformedOffset >= span.transformedStart && transformedOffset <= spanEnd) {
      return transformedOffset - span.transformedStart + span.originalStart;
    }
  }

  // Past the end of all spans — use last span's end boundary
  if (correlatedSpans.length > 0) {
    const last = correlatedSpans[correlatedSpans.length - 1];
    const lastTransformedEnd = last.transformedStart + last.transformedLength;
    const lastOriginalEnd = last.originalStart + last.originalLength;
    if (transformedOffset >= lastTransformedEnd) {
      return lastOriginalEnd + (transformedOffset - lastTransformedEnd);
    }
  }

  return transformedOffset;
}

/**
 * Walk the AST and remap all positions from transformed-space to original-space.
 * Nodes entirely inside a template span are skipped (replaced by Glimmer AST later).
 *
 * @param {object} ast - the parsed AST (mutated in-place)
 * @param {object} visitorKeys - ESLint visitor keys
 * @param {Array} correlatedSpans
 * @param {string} originalCode - original source code
 * @returns {{ templateSpans: Array }}
 */
function remapAstPositions(ast, visitorKeys, correlatedSpans, originalCode) {
  const templateSpans = getTemplateSpans(correlatedSpans);
  const originalDoc = new DocumentLines(originalCode);

  function remapNode(node) {
    if (!node || typeof node !== 'object' || !node.range) return;

    const startOriginal = remapOffset(correlatedSpans, templateSpans, node.range[0]);
    const endOriginal = remapOffset(correlatedSpans, templateSpans, node.range[1]);

    // If both endpoints are inside a template span, skip — will be replaced
    if (startOriginal === null && endOriginal === null) {
      return;
    }

    // Remap positions. If one end is null (crosses boundary), use the template boundary.
    let newStart = startOriginal;
    let newEnd = endOriginal;

    if (newStart === null) {
      // Start is inside a template span — find the span and use its original start
      for (const tpl of templateSpans) {
        if (node.range[0] >= tpl.transformedStart && node.range[0] < tpl.transformedEnd) {
          newStart = tpl.originalStart;
          break;
        }
      }
    }
    if (newEnd === null) {
      // End is inside a template span — find the span and use its original end
      for (const tpl of templateSpans) {
        if (node.range[1] > tpl.transformedStart && node.range[1] <= tpl.transformedEnd) {
          newEnd = tpl.originalEnd;
          break;
        }
      }
    }

    // If either endpoint is still null after fallback, skip this node
    if (newStart === null || newEnd === null) return;

    node.range = [newStart, newEnd];
    node.start = newStart;
    node.end = newEnd;
    node.loc = {
      start: originalDoc.offsetToPosition(newStart),
      end: originalDoc.offsetToPosition(newEnd),
    };
  }

  // Walk AST and remap all nodes
  const queue = [ast];
  while (queue.length > 0) {
    const node = queue.pop();
    if (!node || typeof node !== 'object') continue;

    remapNode(node);

    const keys = visitorKeys[node.type] || [];
    for (const key of keys) {
      const child = node[key];
      if (!child) continue;
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) {
            queue.push(item);
          }
        }
      } else if (child.type) {
        queue.push(child);
      }
    }
  }

  return { templateSpans };
}

/**
 * Remap tokens from transformed-space to original-space.
 * Tokens inside template spans are discarded (replaced by Glimmer tokens later).
 *
 * @param {Array} tokens
 * @param {Array} correlatedSpans
 * @param {Array} templateSpans
 * @param {string} originalCode
 * @returns {Array} remapped non-template tokens
 */
function remapTokens(tokens, correlatedSpans, templateSpans, originalCode) {
  const originalDoc = new DocumentLines(originalCode);
  const remapped = [];

  for (const token of tokens) {
    // Skip tokens entirely within a template span
    let inTemplate = false;
    for (const tpl of templateSpans) {
      if (token.range[0] >= tpl.transformedStart && token.range[1] <= tpl.transformedEnd) {
        inTemplate = true;
        break;
      }
    }
    if (inTemplate) continue;

    const newStart = remapOffset(correlatedSpans, templateSpans, token.range[0]);
    const newEnd = remapOffset(correlatedSpans, templateSpans, token.range[1]);

    if (newStart === null || newEnd === null) continue; // edge case: skip

    token.range = [newStart, newEnd];
    token.start = newStart;
    token.end = newEnd;
    token.loc = {
      start: { ...originalDoc.offsetToPosition(newStart), index: newStart },
      end: { ...originalDoc.offsetToPosition(newEnd), index: newEnd },
    };

    remapped.push(token);
  }

  return remapped;
}

export { getTemplateSpans, remapOffset, remapAstPositions, remapTokens };
