import { describe, expect, it } from 'vitest';
import { formatCompactCount, formatRelativeTime } from './format';

describe('formatCompactCount', () => {
  it('leaves small counts untouched', () => {
    expect(formatCompactCount(42)).toBe('42');
    expect(formatCompactCount(999)).toBe('999');
  });

  it('compacts thousands with one decimal, dropping a trailing .0', () => {
    expect(formatCompactCount(1000)).toBe('1k');
    expect(formatCompactCount(1500)).toBe('1.5k');
    expect(formatCompactCount(12345)).toBe('12.3k');
  });
});

describe('formatRelativeTime', () => {
  it('formats seconds', () => {
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
    expect(formatRelativeTime(fiveSecondsAgo)).toMatch(/^\d+ seconds? ago$/);
  });

  it('formats days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  it('uses singular unit for a value of exactly 1', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });
});
