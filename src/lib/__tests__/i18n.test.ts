import { describe, expect, it } from 'vitest';
import { en, type MsgKey } from '../../i18n/en';
import { ar } from '../../i18n/ar';
import { hi } from '../../i18n/hi';
import { translate } from '../../i18n';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');

describe('Translations', () => {
  it('Arabic and Hindi keep every {placeholder} of the English text', () => {
    for (const key of Object.keys(en) as MsgKey[]) {
      expect(placeholders(ar[key]), `ar ${key}`).toBe(placeholders(en[key]));
      expect(placeholders(hi[key]), `hi ${key}`).toBe(placeholders(en[key]));
    }
  });

  it('has no empty translations', () => {
    for (const key of Object.keys(en) as MsgKey[]) {
      expect(ar[key].trim(), `ar ${key}`).not.toBe('');
      expect(hi[key].trim(), `hi ${key}`).not.toBe('');
    }
  });

  it('fills in placeholders', () => {
    expect(translate('common.dayOf', { day: 3, total: 40 }, 'en')).toBe('Day 3 of 40');
    expect(translate('common.dayOf', { day: 3, total: 40 }, 'ar')).toBe('اليوم 3 من 40');
    expect(translate('checkin.morning', undefined, 'hi')).toBe('सुबह');
  });
});
