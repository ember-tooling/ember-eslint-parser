import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { patchTs } from '../src/parser/ts-patch.js';
import { warnOnProjectSizeLimitDemotion } from '../src/parser/size-limit-warning.js';

// Same typescript instance ts-patch patches, so we observe the patched ts.sys.
const require = createRequire(import.meta.url);
const parserPath = require.resolve('@typescript-eslint/parser');
const ts = require(require.resolve('typescript', { paths: [parserPath] }));

// TypeScript's ProjectService sums host.getFileSize() over every root that is
// not a TS extension and, past maxProgramSizeForNonTsFiles (20MB), disables the
// project's language service — which leaves it with only the files the client
// has open as program roots. `.gts` is TypeScript with a template in it, so it
// has no business being weighed against a JavaScript budget. `.gjs` is
// JavaScript and is deliberately still counted.
describe('patched ts.sys.getFileSize — .gts is not charged to the non-TS size budget', () => {
  patchTs();

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-parser-size-'));
  const write = (name, bytes) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, 'x'.repeat(bytes));
    return file;
  };

  const gts = write('component.gts', 4096);
  const gjs = write('component.gjs', 4096);
  const tsFile = write('component.ts', 4096);
  const js = write('component.js', 4096);

  it('reports .gts as weightless', () => {
    expect(ts.sys.getFileSize(gts)).toBe(0);
  });

  it('still reports the real size for .gjs, which is JavaScript', () => {
    expect(ts.sys.getFileSize(gjs)).toBe(4096);
  });

  it('leaves .ts and .js sizes alone', () => {
    expect(ts.sys.getFileSize(tsFile)).toBe(4096);
    expect(ts.sys.getFileSize(js)).toBe(4096);
  });

  it('reports a missing file as 0, like the unpatched host', () => {
    expect(ts.sys.getFileSize(path.join(dir, 'nope.js'))).toBe(0);
  });
});

describe('warnOnProjectSizeLimitDemotion', () => {
  // A stand-in for the slice of ts.server the hook touches, so the assertions
  // don't depend on driving a real ProjectService over a >20MB fixture.
  function fakeTs() {
    const calls = [];
    class Project {
      constructor(name) {
        this.name = name;
      }

      getProjectName() {
        return this.name;
      }

      disableLanguageService(lastFileExceededProgramSize) {
        calls.push(lastFileExceededProgramSize);
      }
    }
    return {
      ts: { server: { Project, maxProgramSizeForNonTsFiles: 20 * 1024 * 1024 } },
      calls,
    };
  }

  it('warns once, naming the project and disableSizeLimit', () => {
    const { ts: fake, calls } = fakeTs();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      warnOnProjectSizeLimitDemotion(fake);

      new fake.server.Project('/app/tsconfig.json').disableLanguageService('/app/a.gjs');
      new fake.server.Project('/other/tsconfig.json').disableLanguageService('/other/b.gjs');

      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0];
      expect(message).toContain('/app/tsconfig.json');
      expect(message).toContain('/app/a.gjs');
      expect(message).toContain('disableSizeLimit');
      expect(message).toContain('20MB');
      // Observation only — the real demotion still has to happen.
      expect(calls).toEqual(['/app/a.gjs', '/other/b.gjs']);
    } finally {
      warn.mockRestore();
    }
  });

  it('stays quiet when the language service is disabled for some other reason', () => {
    const { ts: fake, calls } = fakeTs();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      warnOnProjectSizeLimitDemotion(fake);
      new fake.server.Project('/app/tsconfig.json').disableLanguageService();

      expect(warn).not.toHaveBeenCalled();
      expect(calls).toEqual([undefined]);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not stack wrappers when applied twice', () => {
    const { ts: fake } = fakeTs();
    warnOnProjectSizeLimitDemotion(fake);
    const first = fake.server.Project.prototype.disableLanguageService;
    warnOnProjectSizeLimitDemotion(fake);

    expect(fake.server.Project.prototype.disableLanguageService).toBe(first);
  });

  it('is a no-op against a typescript build with no server API', () => {
    expect(() => warnOnProjectSizeLimitDemotion({})).not.toThrow();
    expect(() => warnOnProjectSizeLimitDemotion(undefined)).not.toThrow();
  });
});
