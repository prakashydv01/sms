# School Management System — v1 Foundation

## What's built so far

- **Multi-tenant schema** (Postgres + Drizzle ORM): schools, users (roles), academic years, classes, sections, students, import batches, fee types, student fee assignments, invoices, payments.
- **Auth**: email/password login (Auth.js v5), session-based — every page reads the logged-in user's `schoolId`/`role` from their session. All routes except `/login` require a session (`src/proxy.ts`).
- **Student module**: manual add form + Excel/CSV bulk import wizard (upload → map columns → validate/preview → import), sharing one Zod schema and one save function.
- **Fees module**:
  - Multiple fee types per school (e.g. Monthly Tuition, Admit Card Fee, ID Card Fee), each with its own frequency (one-time/monthly/termly/annual) and default amount
  - Per-student fee assignment with an overridable amount — this is how scholarships/discounts work (assign at a different amount than the fee type's default)
  - One-time fees auto-generate their single invoice on assignment
  - Recurring fees are invoiced via "Generate invoices for period" (e.g. "April 2026") — safe to re-run, already-generated invoices are skipped, not duplicated
  - Partial payments supported; overpayment beyond the remaining balance is rejected
  - Every invoice status (unpaid/partial/paid/waived) is derived from actual recorded payments, not tracked separately
- **UI**: dense, admin-tool style — top bar with school/user/sign out, toolbar-driven panels, bordered tables with status badges, tabbed Fees page (Overview / Fee types / Assign & generate).

## Running it locally

1. `npm install`
2. Set up Postgres (local or Supabase/Neon) and set `DATABASE_URL` in `.env`.
3. Set `AUTH_SECRET` in `.env` — generate with `openssl rand -base64 32`.
4. `npm run db:generate && npm run db:migrate`
5. `npm run db:seed` — prints a login: `admin@greenvalley.edu / admin123`. Change this before using real data.
6. `npm run dev`, visit `http://localhost:3000`, sign in with the seeded credentials.

## Money handling note

All amounts are stored as integers in the smallest currency unit (paisa/cents) to avoid floating-point rounding bugs — e.g. ₹900.00 is stored as `90000`. Forms accept and display decimal amounts; conversion happens at the action layer (`Math.round(amount * 100)` going in, `/ 100` coming out). If you change currencies, this convention should stay consistent throughout.

## What's deliberately NOT built yet

- Role-based UI differences (a teacher and school_admin see the same thing right now — `role` exists on the session but nothing branches on it)
- Payment gateway integration (all payments are manually recorded — cash/bank transfer/online/cheque as a label, not an actual online payment flow)
- Invoice PDF generation / receipts
- Fee reminders/notifications
- Undo UI for imports (`undoImportBatch()` exists in code, no button yet)
- Attendance, grades, timetable, communication modules

## Known limitations to keep in mind

- `discountReason` is a free-text field, not a structured discount type — fine for a single school, would need restructuring for reporting across schools.
- Recurring invoice generation is manual (a button), not scheduled — there's no cron/background job yet to auto-generate next month's invoices.

## Recommended next step
Branch the UI by role, since right now anyone who logs in — teacher or admin — can create fee types, assign fees, and record payments. That's a real gap before this goes anywhere near production use with multiple staff accounts.

## v1.1 update — Fees module improvements

**Root cause fixed: "invoice created but not showing"** — this was a real Next.js App Router bug. Forms called server actions via `startTransition()` instead of a native `<form action={serverAction}>` binding, so Next.js never automatically refreshed the page's server-fetched data after a mutation. `revalidatePath()` alone marks the server cache stale but doesn't force an already-mounted client component to re-fetch. Fixed by adding `router.refresh()` (from `next/navigation`) after every successful mutation — in the fees page, the student add form, and the import wizard.

**New in Fees:**
- **Bulk assign by class/section** — assign a fee type to an entire class (or one section within it) in one action, instead of one student at a time. Students who already have that fee are skipped, not duplicated.
- **Scoped invoice generation** — "Generate invoices" now accepts optional class/section filters, so you can generate for one class at a time or all classes at once.
- **Overview filters + summary stats** — filter by class, section, fee type, and status; stat cards show total invoices, total due, total collected, and outstanding balance for whatever's currently filtered.
- **Edit invoice** — adjust the amount due or due date. Blocked from going below what's already been paid (edit the payment record instead if that's wrong).
- **Delete invoice** — only allowed when zero payments have been recorded against it. An invoice with payment history must be **waived**, not deleted, so the payment ledger never points at a vanished invoice.
- **Payments now record who took them** — `recordPayment` reads the actual logged-in user from the session instead of a caller-supplied (previously always empty) value.

All of the above was tested end-to-end against a live Postgres database with realistic multi-class/multi-section data before shipping — not just written and assumed correct.
