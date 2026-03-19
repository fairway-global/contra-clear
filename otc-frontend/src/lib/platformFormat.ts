export function formatDateTime(value?: string): string {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatRelativeTime(value?: string): string {
  if (!value) return 'just now';
  const diffMs = new Date(value).getTime() - Date.now();
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absSeconds < 60) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (absSeconds < 3600) return rtf.format(Math.round(diffMs / 60000), 'minute');
  if (absSeconds < 86400) return rtf.format(Math.round(diffMs / 3600000), 'hour');
  return rtf.format(Math.round(diffMs / 86400000), 'day');
}

export function formatAmount(value: string, asset?: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return asset ? `${value} ${asset}` : value;

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: numeric >= 1000 ? 0 : 4,
  }).format(numeric);

  return asset ? `${formatted} ${asset}` : formatted;
}

export function formatPrice(value: string, baseAsset: string, quoteAsset: string): string {
  return `${formatAmount(value)} ${quoteAsset}/${baseAsset}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
