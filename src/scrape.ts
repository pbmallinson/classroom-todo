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

// Injected into the page — must be a plain function, no TS types
const SCRAPER = `(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();

  function parseDue(raw, section) {
    if (!raw) return null;
    const s = raw.replace(/^Due\\s*/i, '').trim();
    if (/^today$/i.test(s))    return new Date(today);
    if (/^tomorrow$/i.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return d; }
    // Handle weekday-only dates like "Wednesday, 11:59 PM" — resolve via section
    const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dowMatch = s.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b/i);
    if (dowMatch) {
      const target = DAYS.indexOf(dowMatch[1].toLowerCase());
      // Find Monday of the relevant week based on section
      const todayDow = today.getDay();
      const mondayOffset = (todayDow + 6) % 7; // days since last Monday
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - mondayOffset);
      if (section === 'LAST_WEEK') weekStart.setDate(weekStart.getDate() - 7);
      else if (section === 'NEXT_WEEK') weekStart.setDate(weekStart.getDate() + 7);
      else if (section === 'EARLIER') return null; // too ambiguous
      // target's offset from Monday in Mon-based week (Mon=0 … Sun=6)
      const targetOffset = (target + 6) % 7;
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + targetOffset);
      return d;
    }
    const hasYear = /\\b20\\d\\d\\b/.test(s);
    const attempt = hasYear ? s : s + ' ' + thisYear;
    const d = new Date(attempt);
    if (!isNaN(d)) return d;
    const stripped = s.replace(/^[A-Za-z]{3}\\s+/, '');
    const d2 = new Date(stripped + ' ' + thisYear);
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
    const key  = idEl ? idEl.dataset.courseId + '|' + idEl.dataset.streamItemId : null;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);

    const title  = li.querySelector('p.oDLUVd')?.textContent?.trim() || '?';
    const course = li.querySelector('p.tWeh6:not(.iiWxqc)')?.textContent?.trim() || '?';
    const rawDue = li.querySelector('p.pOf0gc')?.textContent?.trim()
                || li.querySelector('div.nQaZq p')?.textContent?.trim()
                || null;

    const dueDate = parseDue(rawDue, section);
    if (!dueDate || dueDate.getFullYear() !== thisYear) return;

    items.push({ title, course, days: diffDays(dueDate), dateStr: fmtDate(dueDate) });
  });

  items.sort((a, b) => b.days - a.days);
  return items;
})()`;

async function scrapeKid(kidName: string): Promise<void> {
  const sessionDir = path.join('sessions', kidName.toLowerCase());
  if (!fs.existsSync(sessionDir)) {
    console.error(`  No session for ${kidName} — run: npm run login ${kidName}`);
    return;
  }

  const browser = await chromium.launchPersistentContext(sessionDir, { headless: true });
  const page = await browser.newPage();

  // Check session is alive on first URL
  await page.goto(URLS[0], { waitUntil: 'domcontentloaded' });
  if (page.url().includes('accounts.google.com')) {
    console.error(`  Session expired for ${kidName} — run: npm run login ${kidName}`);
    await browser.close();
    return;
  }

  type Item = { days: number; dateStr: string; course: string; title: string };
  const seen = new Set<string>();
  const allItems: Item[] = [];

  for (const url of URLS) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('li.MHxtic', { timeout: 15000 }).catch(() => null);

    const items = await page.evaluate(SCRAPER) as Item[];
    for (const item of items) {
      const key = `${item.course}|${item.title}`;
      if (!seen.has(key)) { seen.add(key); allItems.push(item); }
    }
  }

  await browser.close();
  const items = allItems;

  items.sort((a, b) => b.days - a.days);

  const bar = '═'.repeat(72);
  console.log(`\n${bar}`);
  console.log(`  ${kidName}`);
  console.log(bar);

  if (items.length === 0) {
    console.log('  (nothing outstanding with a due date)');
    return;
  }

  const maxW = Math.max(...items.map(i => String(i.days).length));
  for (const { days, dateStr, course, title } of items) {
    console.log(`  ${String(days).padStart(maxW)}\t${dateStr}\t${course}\t${title}`);
  }
}

async function main(): Promise<void> {
  const configPath = 'config/kids.yml';
  if (!fs.existsSync(configPath)) {
    console.error(`Missing ${configPath} — copy config/kids.example.yml`);
    process.exit(1);
  }

  const config: Config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  for (const kid of config.kids) {
    await scrapeKid(kid.name);
  }
  console.log('');
}

main().catch(console.error);
