import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildXlsx, safeSheetName } from '../xlsx';

describe('Excel report (Phase 22)', () => {
  it('writes sheets with a bold header, text and numbers', () => {
    const file = buildXlsx([
      { name: 'Day by day', rows: [['Day', 'Morning'], [1, 4], ['Note <x> & "y"', null]] },
      { name: 'Students', rows: [['Name'], ['أسماء'], ['आशा']] },
    ]);
    const parts = unzipSync(file);
    expect(Object.keys(parts)).toContain('xl/worksheets/sheet2.xml');
    const s1 = strFromU8(parts['xl/worksheets/sheet1.xml']);
    expect(s1).toContain('<c r="B2"><v>4</v></c>');
    expect(s1).toContain('s="1"');
    expect(s1).toContain('Note &lt;x&gt; &amp; &quot;y&quot;');
    expect(strFromU8(parts['xl/workbook.xml'])).toContain('name="Students"');
    expect(strFromU8(parts['xl/worksheets/sheet2.xml'])).toContain('أسماء');
  });

  it('keeps sheet names Excel accepts', () => {
    expect(safeSheetName('Lotus: week 1/2 [draft]')).toBe('Lotus  week 1 2  draft ');
    expect(safeSheetName('x'.repeat(40))).toHaveLength(31);
  });
});
