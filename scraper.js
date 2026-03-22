// Paste into browser console on https://classroom.google.com/u/0/a/not-turned-in/all
// Output: tab-separated, future first → overdue last. Copies to clipboard automatically.
// Columns: days  due-date  class  title
(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();

  // Parse strings like "Due Mar 28", "Due 28 Mar", "Due today", "Due tomorrow",
  // "Due Mon 24 Mar", "Mar 28", "28 Mar" etc.
  function parseDue(raw) {
    if (!raw) return null;
    const s = raw.replace(/^Due\s*/i, '').trim();
    if (/^today$/i.test(s))    return new Date(today);
    if (/^tomorrow$/i.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return d; }

    const hasYear = /\b20\d\d\b/.test(s);
    const attempt = hasYear ? s : `${s} ${thisYear}`;
    const d = new Date(attempt);
    if (!isNaN(d)) return d;

    // Fallback: strip weekday prefix ("Mon 24 Mar" → "24 Mar")
    const stripped = s.replace(/^[A-Za-z]{3}\s+/, '');
    const d2 = new Date(`${stripped} ${thisYear}`);
    return isNaN(d2) ? null : d2;
  }

  function diffDays(d) {
    return Math.round((d - today) / 86400000);
  }

  function fmtDate(d) {
    return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const seen  = new Set();
  const items = [];

  document.querySelectorAll('li.MHxtic').forEach(li => {
    const section = li.closest('[data-id]')?.dataset?.id || '';
    if (!['LAST_WEEK','EARLIER','THIS_WEEK','NEXT_WEEK','LATER'].includes(section)) return;

    const idEl = li.querySelector('[data-stream-item-id]');
    const key  = idEl ? `${idEl.dataset.courseId}|${idEl.dataset.streamItemId}` : null;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);

    const title  = li.querySelector('p.oDLUVd')?.textContent?.trim() || '?';
    const course = li.querySelector('p.tWeh6:not(.iiWxqc)')?.textContent?.trim() || '?';
    const rawDue = li.querySelector('p.pOf0gc')?.textContent?.trim()
                || li.querySelector('div.nQaZq p')?.textContent?.trim()
                || null;

    const dueDate = parseDue(rawDue);
    if (!dueDate) return;
    if (dueDate.getFullYear() !== thisYear) return;  // drop old years

    items.push({ title, course, dueDate, days: diffDays(dueDate) });
  });

  // Sort: most future first, most overdue last
  items.sort((a, b) => b.days - a.days);

  const maxW = items.length ? Math.max(...items.map(i => String(i.days).length)) : 1;

  const lines = items.map(({ days, dueDate, course, title }) =>
    [String(days).padStart(maxW), fmtDate(dueDate), course, title].join('\t')
  );

  const output = lines.join('\n');
  console.log(output);

  navigator.clipboard.writeText(output)
    .then(() => console.log(`\n✓ ${items.length} items copied to clipboard`))
    .catch(() => console.warn('⚠ Clipboard write blocked — copy from above manually'));
})();
