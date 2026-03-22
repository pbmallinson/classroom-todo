// Run once per kid to save their browser session.
// Opens a real Chrome window — log in as the student, then close it.
// Usage: npm run login <KidName>
import { chromium } from 'playwright';
import * as path from 'path';

const kidName = process.argv[2];
if (!kidName) {
  console.error('Usage: npm run login <KidName>');
  process.exit(1);
}

const sessionDir = path.join('sessions', kidName.toLowerCase());

(async () => {
  console.log(`\nOpening browser for ${kidName}...`);
  console.log('Log in to Google Classroom as the student, then close the browser window.\n');

  const browser = await chromium.launchPersistentContext(sessionDir, {
    headless: false,
  });

  const page = await browser.newPage();
  await page.goto('https://classroom.google.com');

  // Wait for user to confirm they've logged in
  await new Promise<void>(resolve => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press Enter once you are logged in and can see Classroom... ', () => { rl.close(); resolve(); });
  });

  await browser.close();
  console.log(`\nSession saved to ${sessionDir}/ — run "npm run todo" to fetch assignments.`);
})().catch(console.error);
