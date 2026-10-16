/* THE WORKING CALENDAR (16 Oct 2026, after an outside review found a forecast and a promise shown apart).
   A workshop day is WORK_START to WORK_END on the days in WORK_DAYS, in the browser's own clock, which for a Sri Lankan
   workshop is Asia/Colombo. Minutes of work are laid onto that calendar to give a forecast date. Deliberately plain:
   no holidays yet (Poya days and public holidays are a list the owner will keep in Settings, decision pending), no shifts.
   Everything that turns "hours of work" into "a date" goes through here, so the floor, the job card and the seed agree. */
export const WORK_START = 8;        /* 08:00 */
export const WORK_END = 16;         /* 16:00, so one working day is 8 hours of work */
export const WORK_DAYS = [1, 2, 3, 4, 5, 6];   /* Monday to Saturday; Sunday off */
export const DAY_MINUTES = (WORK_END - WORK_START) * 60;

function startOfWork(d: Date): Date { const x = new Date(d); x.setHours(WORK_START, 0, 0, 0); return x; }
function endOfWork(d: Date): Date { const x = new Date(d); x.setHours(WORK_END, 0, 0, 0); return x; }
function nextWorkMorning(d: Date): Date { const x = new Date(d); x.setDate(x.getDate() + 1); x.setHours(WORK_START, 0, 0, 0); while (!WORK_DAYS.includes(x.getDay())) x.setDate(x.getDate() + 1); return x; }

/* the moment `minutes` of work will be done, starting from `from` and counting only working time */
export function addWorkingMinutes(from: number | Date, minutes: number): Date {
  let t = new Date(from); let left = Math.max(0, Math.round(minutes));
  /* move to the next moment work can happen */
  if (!WORK_DAYS.includes(t.getDay()) || t >= endOfWork(t)) t = nextWorkMorning(t);
  else if (t < startOfWork(t)) t = startOfWork(t);
  while (left > 0) {
    const room = Math.round((endOfWork(t).getTime() - t.getTime()) / 60000);
    if (left <= room) { t = new Date(t.getTime() + left * 60000); left = 0; }
    else { left -= room; t = nextWorkMorning(t); }
  }
  return t;
}

/* working days of 8 hours, rounded up, for the words on a tile ("About 3 working days left") */
export function workingDaysLeft(minutes: number): number { return Math.ceil(Math.max(0, minutes) / DAY_MINUTES); }

/* working minutes between two moments, the mirror of addWorkingMinutes, for the day a promise is at risk */
export function workingMinutesBetween(from: number | Date, to: number | Date): number {
  let t = new Date(from); const end = new Date(to); let total = 0;
  if (end <= t) return 0;
  if (!WORK_DAYS.includes(t.getDay()) || t >= endOfWork(t)) t = nextWorkMorning(t);
  else if (t < startOfWork(t)) t = startOfWork(t);
  while (t < end) {
    const stop = endOfWork(t) < end ? endOfWork(t) : end;
    if (stop > t) total += Math.round((stop.getTime() - t.getTime()) / 60000);
    t = nextWorkMorning(t);
  }
  return total;
}
