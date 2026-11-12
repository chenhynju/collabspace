/** Calendar dates use the product timezone, independent of browser locale. */
export function displayDate(value?: string | null): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(value));
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Snapshot timestamps must distinguish edits on the same calendar day. */
export function displayDateTime(value?: string | null): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).format(new Date(value));
}
