# classroom-todo

Terminal view of Google Classroom assignments across multiple students.

```
══════════════════════════════════════════════════════════════════════
  Arlo
══════════════════════════════════════════════════════════════════════

  NEW TODAY (2)
  ──────────────────────────────────────────────────────────────────
  English                   Write a sonnet                           Fri 28 Mar
  Biology                   Cell division quiz prep                  tomorrow

  DUE SOON — next 5 days (3)
  ──────────────────────────────────────────────────────────────────
  Maths                     Quadratics worksheet                     today (OVERDUE)
  History                   WW1 essay draft                          Thu 27 Mar
  Chemistry                 Lab report                               Sat 29 Mar

  OUTSTANDING (12)
  ──────────────────────────────────────────────────────────────────
  ...
```

## Setup

### 1. Google Cloud project (once only)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (name it anything)
3. Enable the **Google Classroom API**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
5. Application type: **Desktop app**
6. Download the JSON and save it as `credentials.json` in this directory

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your kids

```bash
cp config/kids.example.yml config/kids.yml
```

Edit `config/kids.yml`:

```yaml
kids:
  - name: Arlo
  - name: Isla
```

### 4. Authorise each student (once per kid)

```bash
npm run auth Arlo
```

This opens a browser URL. Log in as the student, approve access, paste the code back into the terminal. Token is saved to `tokens/arlo.json` — you won't need to repeat this.

Repeat for each kid.

### 5. Run

```bash
npm run todo
```

## Notes

- Tokens refresh automatically — no need to re-auth
- `credentials.json` and `tokens/` are gitignored — keep them safe
- `DUE_SOON_DAYS` in `src/todo.ts` controls the "due soon" window (default: 5 days)
