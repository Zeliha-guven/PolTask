// Mimari kurallar (docs/architecture.md): AC-2 değer listeleri sabit değil, AC-3 fetch yalnız src/api'de.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { META_VALUES } from './test/fixtures';

const SRC = __dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const rel = (p: string) => relative(SRC, p).split(sep).join('/');
const isTestCode = (p: string) => /\.test\.(ts|tsx)$/.test(p) || rel(p).startsWith('test/');
const productionFiles = sourceFiles(SRC).filter((p) => !isTestCode(p));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('mimari', () => {
  it('taranacak üretim kodu var', () => {
    expect(productionFiles.length).toBeGreaterThan(10);
  });

  it('AC-2: durum / kapsam tipi / sözleşme değerleri web/src içinde sabit yazılmaz', () => {
    const offenders: string[] = [];
    for (const f of productionFiles) {
      const text = readFileSync(f, 'utf8');
      for (const v of META_VALUES) {
        // Kelime sınırı (Türkçe harfler dahil) ile ara
        const re = new RegExp(`(^|[^\\p{L}])${escape(v)}($|[^\\p{L}])`, 'u');
        if (re.test(text)) offenders.push(`${rel(f)}: "${v}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('AC-3: fetch yalnız web/src/api altında çağrılır', () => {
    const offenders = productionFiles
      .filter((f) => !rel(f).startsWith('api/'))
      .filter((f) => /\bfetch\s*\(/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('dangerouslySetInnerHTML kullanılmaz', () => {
    const offenders = productionFiles.filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML')).map(rel);
    expect(offenders).toEqual([]);
  });
});
