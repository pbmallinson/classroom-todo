import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
];

const CREDENTIALS_FILE = 'credentials.json';

async function authenticate(kidName: string): Promise<void> {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    console.error(`Missing ${CREDENTIALS_FILE} — download it from Google Cloud Console`);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log(`\nAuthorising ${kidName}...`);
  console.log('Open this URL in a browser logged in as the student:\n');
  console.log(authUrl);
  console.log('\nAfter approving, paste the code from the redirect URL:');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise<string>((resolve) => rl.question('> ', resolve));
  rl.close();

  const { tokens } = await oAuth2Client.getToken(code.trim());

  const tokenPath = path.join('tokens', `${kidName.toLowerCase()}.json`);
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  console.log(`\nToken saved to ${tokenPath} — you won't need to do this again.`);
}

const kidName = process.argv[2];
if (!kidName) {
  console.error('Usage: npm run auth <kid-name>');
  process.exit(1);
}

authenticate(kidName).catch(console.error);
