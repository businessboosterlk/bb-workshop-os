// THE CALENDAR CHECK, written before the calendar was used anywhere. node mould/parts/CAL/check.mjs
import { execFileSync } from 'node:child_process'; import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const ROOT = process.env.HOME + '/bb-systems/bb-workshop-os';
const D = mkdtempSync(join(tmpdir(), 'cal-')); execFileSync(ROOT + '/apps/web/node_modules/.bin/esbuild', [ROOT + '/apps/web/src/app/core/calendar.ts', '--format=esm', '--outfile=' + join(D, 'c.mjs'), '--log-level=error']);
const C = await import(join(D, 'c.mjs')); const rows = []; let bad = 0, n = 0;
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const at = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi, 0, 0);   /* local clock, the way the app reads it */
const same = (a, b) => Math.abs(a.getTime() - b.getTime()) < 1000;
const fri = at(2026, 10, 16, 9);   /* Friday 16 Oct 2026 */
t('a working day is 8 hours', C.DAY_MINUTES === 480);
t('Sunday is off, Saturday is a working day', !C.WORK_DAYS.includes(0) && C.WORK_DAYS.includes(6));
t('two hours on a Friday morning end the same morning', same(C.addWorkingMinutes(fri, 120), at(2026, 10, 16, 11)));
/* Friday 09:00 to 16:00 is 7 hours of room, so 9 hours spill TWO hours into Saturday (the first version of this line said one: the check's own arithmetic, caught by the code) */
t('nine hours from Friday 09:00 spill two hours into Saturday', same(C.addWorkingMinutes(fri, 540), at(2026, 10, 17, 10)));
t('work from Saturday afternoon crosses Sunday to Monday', same(C.addWorkingMinutes(at(2026, 10, 17, 15), 120), at(2026, 10, 19, 9)));
t('work asked for on a Sunday starts Monday 08:00', same(C.addWorkingMinutes(at(2026, 10, 18, 11), 60), at(2026, 10, 19, 9)));
t('work asked for after closing starts next morning', same(C.addWorkingMinutes(at(2026, 10, 16, 18), 60), at(2026, 10, 17, 9)));
t('work asked for before opening starts at 08:00', same(C.addWorkingMinutes(at(2026, 10, 16, 6), 60), at(2026, 10, 16, 9)));
t('zero minutes is now, moved to working time', same(C.addWorkingMinutes(fri, 0), fri));
t('five working days from Friday morning land on Thursday morning (Sunday skipped)', same(C.addWorkingMinutes(fri, 5 * 480), at(2026, 10, 22, 9)));
t('workingDaysLeft rounds up', C.workingDaysLeft(481) === 2 && C.workingDaysLeft(480) === 1 && C.workingDaysLeft(0) === 0);
/* Friday 7 h, Saturday 8 h, Monday 1 h = 16 hours */
t('the mirror: minutes between Friday 09:00 and Monday 09:00 are 16 hours', C.workingMinutesBetween(fri, at(2026, 10, 19, 9)) === 16 * 60);
t('the mirror of addWorkingMinutes gives the minutes back', [30, 400, 1500, 5 * 480].every(m => C.workingMinutesBetween(fri, C.addWorkingMinutes(fri, m)) === m));
t('a promise already past has no working minutes left', C.workingMinutesBetween(fri, at(2026, 10, 15, 9)) === 0);
console.log(rows.join('\n')); console.log(bad ? `FAIL ${n - bad}/${n}` : `PASS ${n}/${n}`); process.exit(bad ? 1 : 0);
