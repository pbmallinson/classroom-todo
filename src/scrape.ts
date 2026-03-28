// Headless Classroom scraper. Reads sessions saved by login.ts.
// Usage: npm run todo
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Config } from './types';

const URLS = [
  'https://classroom.google.com/a/not-turned-in/all',
  'https://classroom.google.com/a/missing/all',
];

const DEBUG = process.env.DEBUG === '1';

// Injected into the page — must be a plain function, no TS types
const SCRAPER = `((debug) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();

  function parseExplicitDate(s) {
    if (!s || /^20\\d\\d$/.test(s.trim())) return null; // empty or bare year
    // Must contain a month name — pure time strings like "11:59 PM" are not dates
    if (!/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s)) return null;
    const hasYear = /\\b20\\d\\d\\b/.test(s);
    const attempt = hasYear ? s : s + ' ' + thisYear;
    const d = new Date(attempt);
    if (!isNaN(d.getTime())) return d;
    // DD Mon [YYYY] format (e.g. "31 Mar" or "31 Mar 2026")
    const dmy = s.match(/^(\\d{1,2})\\s+([A-Za-z]{3,9})(?:[,\\s]+(\\d{4}))?/);
    if (dmy) {
      const d2 = new Date(dmy[2] + ' ' + dmy[1] + ' ' + (dmy[3] || thisYear));
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  }

  function parseDue(raw, section) {
    if (!raw) return null;
    const s = raw.replace(/^Due\\s*/i, '').trim();
    // "Today" / "Tomorrow" may have a time suffix like "Tomorrow, 11:59 PM"
    if (/^today\\b/i.test(s))    return new Date(today);
    if (/^tomorrow\\b/i.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return d; }

    const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dowMatch = s.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b/i);

    // Strip leading weekday + separator (e.g. "Friday, " or "Fri ") to get the date part
    const afterWday = dowMatch ? s.replace(/^[A-Za-z]+(?:,\\s*|\\s+)/, '') : s;

    // If there's an explicit date in the string, always prefer it
    const explicit = parseExplicitDate(afterWday);
    if (explicit) return explicit;

    // Fall back to weekday resolution for THIS_WEEK / NEXT_WEEK / LAST_WEEK
    // Google uses Sun-Sat weeks; DAYS indices (0=Sun … 6=Sat) are the offset from Sunday
    if (dowMatch && !['LATER','EARLIER'].includes(section)) {
      const target = DAYS.indexOf(dowMatch[1].toLowerCase());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // back to this Sunday
      if (section === 'LAST_WEEK') weekStart.setDate(weekStart.getDate() - 7);
      else if (section === 'NEXT_WEEK') weekStart.setDate(weekStart.getDate() + 7);
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + target);
      return d;
    }

    return null;
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
    const key  = idEl ? idEl.dataset.courseId + '|' + idEl.dataset.streamItemId : null;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);

    const title  = li.querySelector('p.oDLUVd')?.textContent?.trim() || '?';
    const course = li.querySelector('p.tWeh6:not(.iiWxqc)')?.textContent?.trim() || '?';
    const rawDue = li.querySelector('p.pOf0gc')?.textContent?.trim()
                || li.querySelector('div.nQaZq p')?.textContent?.trim()
                || null;

    const dueDate = parseDue(rawDue, section);
    const yearOk = dueDate && (dueDate.getFullYear() === thisYear || dueDate.getFullYear() === thisYear + 1);
    if (!yearOk) {
      if (debug) console.log('[DEBUG skip] section=' + section + ' rawDue=' + JSON.stringify(rawDue) + ' parsed=' + dueDate + ' course=' + course + ' title=' + title);
      return;
    }

    if (debug) console.log('[DEBUG ok]   section=' + section + ' rawDue=' + JSON.stringify(rawDue) + ' parsed=' + dueDate?.toISOString()?.slice(0,10) + ' days=' + diffDays(dueDate) + ' course=' + course);
    items.push({ title, course, days: diffDays(dueDate), dateStr: fmtDate(dueDate) });
  });

  items.sort((a, b) => b.days - a.days);
  return items;
})(${DEBUG})`;

async function scrapeKid(kidName: string): Promise<string> {
  const sessionDir = path.join('sessions', kidName.toLowerCase());
  if (!fs.existsSync(sessionDir)) {
    return `  No session for ${kidName} — run: npm run login ${kidName}`;
  }

  const browser = await chromium.launchPersistentContext(sessionDir, { headless: true });

  // Open both pages simultaneously
  const [page0, page1] = await Promise.all([browser.newPage(), browser.newPage()]);

  if (DEBUG) {
    for (const p of [page0, page1]) {
      p.on('console', msg => {
        if (msg.text().startsWith('[DEBUG')) process.stderr.write(msg.text() + '\n');
      });
    }
  }

  // Navigate both URLs in parallel (eliminates the redundant session-check load)
  await Promise.all(URLS.map((url, i) =>
    [page0, page1][i].goto(url, { waitUntil: 'domcontentloaded' })
  ));

  if (page0.url().includes('accounts.google.com')) {
    await browser.close();
    return `  Session expired for ${kidName} — run: npm run login ${kidName}`;
  }

  type Item = { days: number; dateStr: string; course: string; title: string };

  // Wait for content and scrape both pages in parallel
  const [items0, items1] = await Promise.all([page0, page1].map(async p => {
    await p.waitForSelector('li.MHxtic', { timeout: 15000 }).catch(() => null);
    return p.evaluate(SCRAPER) as Promise<Item[]>;
  }));

  await browser.close();

  const seen = new Set<string>();
  const allItems: Item[] = [];
  for (const item of [...items0, ...items1]) {
    const key = `${item.course}|${item.title}`;
    if (!seen.has(key)) { seen.add(key); allItems.push(item); }
  }

  allItems.sort((a, b) => b.days - a.days);

  const bar = '═'.repeat(72);
  const lines = [`\n${bar}`, `  ${kidName}`, bar];

  if (allItems.length === 0) {
    lines.push('  (nothing outstanding with a due date)');
  } else {
    const maxW = Math.max(...allItems.map(i => String(i.days).length));
    for (const { days, dateStr, course, title } of allItems) {
      lines.push(`  ${String(days).padStart(maxW)}\t${dateStr}\t${course}\t${title}`);
    }
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const configPath = 'config/kids.yml';
  if (!fs.existsSync(configPath)) {
    console.error(`Missing ${configPath} — copy config/kids.example.yml`);
    process.exit(1);
  }

  const config: Config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  const outputs = await Promise.all(config.kids.map(kid => scrapeKid(kid.name)));
  console.log(outputs.join('\n') + '\n');
}

main().catch(console.error);
