import * as fs from 'fs';
import * as yaml from 'yaml';
import { getAssignments } from './classroom';
import { Assignment, Config } from './types';

const DUE_SOON_DAYS = 5;

function bucketAssignments(assignments: Assignment[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const soonCutoff = new Date(todayStart.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);

  const newToday: Assignment[] = [];
  const dueSoon: Assignment[] = [];
  const outstanding: Assignment[] = [];

  for (const a of assignments) {
    if (a.createdTime >= todayStart) {
      newToday.push(a);
    } else if (a.dueDate && a.dueDate <= soonCutoff) {
      dueSoon.push(a);
    } else {
      outstanding.push(a);
    }
  }

  dueSoon.sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  outstanding.sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));

  return { newToday, dueSoon, outstanding };
}

function formatDate(d?: Date): string {
  if (!d) return 'no due date';
  const today = new Date();
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  if (diffDays < 0) return `${label} (OVERDUE)`;
  if (diffDays === 0) return `${label} (today)`;
  if (diffDays === 1) return `${label} (tomorrow)`;
  return label;
}

function printBucket(title: string, assignments: Assignment[]): void {
  const divider = '─'.repeat(70);
  console.log(`\n  ${title} (${assignments.length})`);
  console.log(`  ${divider}`);

  if (assignments.length === 0) {
    console.log('  (none)');
    return;
  }

  for (const a of assignments) {
    const course = a.courseName.substring(0, 22).padEnd(23);
    const title_ = a.title.substring(0, 38).padEnd(39);
    const due = formatDate(a.dueDate);
    console.log(`  ${course}  ${title_}  ${due}`);
  }
}

async function main(): Promise<void> {
  const configPath = 'config/kids.yml';
  if (!fs.existsSync(configPath)) {
    console.error(`Missing ${configPath} — copy config/kids.example.yml and fill in your kids' names`);
    process.exit(1);
  }

  const config: Config = yaml.parse(fs.readFileSync(configPath, 'utf8'));

  for (const kid of config.kids) {
    const bar = '═'.repeat(70);
    console.log(`\n${bar}`);
    console.log(`  ${kid.name}`);
    console.log(`${bar}`);

    try {
      const assignments = await getAssignments(kid.name);
      const { newToday, dueSoon, outstanding } = bucketAssignments(assignments);

      printBucket('NEW TODAY', newToday);
      printBucket(`DUE SOON  (next ${DUE_SOON_DAYS} days)`, dueSoon);
      printBucket('OUTSTANDING', outstanding);
    } catch (e: any) {
      if (e.message?.includes('ENOENT')) {
        console.error(`  No token found — run: npm run auth ${kid.name}`);
      } else {
        console.error(`  Error: ${e.message}`);
      }
    }
  }

  console.log('');
}

main().catch(console.error);
