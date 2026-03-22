# classroom-todo

Terminal view of Google Classroom assignments across multiple students.
Shows not-turned-in and missing items with due dates, sorted future → overdue.

```
════════════════════════════════════════════════════════════════════════
  Ben
════════════════════════════════════════════════════════════════════════
  68    Fri, 29 May    11 DVC 2026       Fragrance Design
   8    Mon, 30 Mar    11 GEO BR 2026    ASSESSMENT - The Bradshaw Model
  -2    Fri, 20 Mar    11 MAT MM 2026    T1W8 Kiwisaver, Homes, Budgeting
```

Tab-separated — paste directly into Excel.

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure your kids

```bash
cp config/kids.example.yml config/kids.yml
```

Edit `config/kids.yml`:

```yaml
kids:
  - name: Ben
  - name: Isla
```

### 3. Log in for each student (once per kid)

```bash
npm run login Ben
```

A browser window opens. Log in as the student, wait until you can see Classroom, then press Enter in the terminal. Session is saved to `sessions/ben/` — you won't need to repeat this unless Google invalidates the session.

Repeat for each kid.

### 4. Run

```bash
npm run todo
```

## Notes

- Sessions are stored in `sessions/` and are gitignored
- If a session expires you'll see: `Session expired for Ben — run: npm run login Ben`
- Only assignments with due dates in the current year are shown
