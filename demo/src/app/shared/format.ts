export function formatCompactCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

const RELATIVE_TIME_DIVISORS = [60, 60, 24, 30, 12];
const RELATIVE_TIME_NAMES = ['second', 'minute', 'hour', 'day', 'month', 'year'];

export function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  let value = Math.max(0, Math.floor((Date.now() - then) / 1000));

  let unitIndex = 0;
  for (; unitIndex < RELATIVE_TIME_DIVISORS.length; unitIndex++) {
    if (value < RELATIVE_TIME_DIVISORS[unitIndex]) break;
    value = Math.floor(value / RELATIVE_TIME_DIVISORS[unitIndex]);
  }

  const unitName = RELATIVE_TIME_NAMES[unitIndex];
  return `${value} ${unitName}${value === 1 ? '' : 's'} ago`;
}
