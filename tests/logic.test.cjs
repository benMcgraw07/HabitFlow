/**
 * HabitFlow logic regression tests (no third-party packages).
 * Runs ACTUAL function declarations loaded from ../app.js, not copied rewrites.
 * Node.js >=18: node --test tests/logic.test.cjs
 * Does not test IndexedDB, PWA caching, OneSignal, or iOS delivery.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').replace(/\r\n/g, '\n');

// These functions are declarations in app.js. We read them from that file
// so the tests always exercise the submitted implementation.
const names = ['getTodayDate', 'getCurrentWeekDates', 'getWeekdaysForDate', 'calculateWeeklyStats', 'formatWeekdays'];
function actualDeclaration(name) {
  const match = new RegExp(`^function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Missing ${name}() in app.js`);
  const closing = source.indexOf('\n}', match.index);
  assert.ok(closing > match.index, `Cannot locate end of ${name}()`);
  return source.slice(match.index, closing + 2);
}
const declarations = names.map(actualDeclaration).join('\n\n');
function boot({ date = '2026-11-23', habits = [], completions = [] } = {}) {
  // The test clock is fixed at noon local time on the specified date.
  // Run in Europe/London timezone: npm scripts set TZ for macOS/Linux;
  // Node on Windows honours the local timezone or can use set TZ=Europe/London.
  const atNoon = new Date(`${date}T12:00:00`);
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [atNoon.getTime()])); }
    static now() { return atNoon.getTime(); }
  }
  const context = vm.createContext({ Date: FakeDate, habits, completions, Set });
  vm.runInContext(declarations, context, { filename: 'actual-app-functions.js' });
  return context;
}
const habit = (id, weekdays, createdOn = '2026-11-23', history) => ({
  id, name: `Habit ${id}`, weekdays, createdOn,
  ...(history === undefined ? {} : { scheduleHistory: history })
});
const done = (id, date) => ({ id: `${id}_${date}`, habitId: id, date });
const plain = value => JSON.parse(JSON.stringify(value));

test('getTodayDate uses local ISO-format calendar date', () => {
  assert.equal(boot({ date: '2026-11-23' }).getTodayDate(), '2026-11-23');
});

test('a Monday-based week has exactly seven ordered days', () => {
  const week = plain(boot().getCurrentWeekDates());
  assert.deepEqual(week.map(d => d.date), [
    '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26',
    '2026-11-27', '2026-11-28', '2026-11-29'
  ]);
  assert.deepEqual(week.map(d => d.weekday), [1, 2, 3, 4, 5, 6, 0]);
});

test('week boundaries cross calendar years', () => {
  const week = plain(boot({ date: '2027-01-01' }).getCurrentWeekDates());
  assert.equal(week[0].date, '2026-12-28');
  assert.equal(week[6].date, '2027-01-03');
});

test('future dates are marked, but the current date is not', () => {
  const week = plain(boot({ date: '2026-11-25' }).getCurrentWeekDates());
  assert.deepEqual(week.map(d => d.isFuture), [false, false, false, true, true, true, true]);
});

test('previous-week navigation returns seven non-future days', () => {
  const week = plain(boot().getCurrentWeekDates(-1));
  assert.equal(week[0].date, '2026-11-16');
  assert.equal(week[6].date, '2026-11-22');
  assert.ok(week.every(d => !d.isFuture));
});

test('weekday formatting starts with Monday and does not mutate input', () => {
  const data = [0, 3, 1];
  assert.equal(boot().formatWeekdays(data), 'Mon, Wed, Sun');
  assert.deepEqual(data, [0, 3, 1]);
});

test('empty week yields zero count and 0%, not NaN', () => {
  const stats = plain(boot().calculateWeeklyStats());
  assert.deepEqual([stats.totalScheduled, stats.totalCompleted, stats.percentage], [0, 0, 0]);
});

test('one scheduled Monday without a completion has 0%', () => {
  const stats = plain(boot({ habits: [habit('a', [1])] }).calculateWeeklyStats());
  assert.deepEqual([stats.totalScheduled, stats.totalCompleted, stats.percentage], [1, 0, 0]);
});

test('one completed scheduled Monday yields 100%', () => {
  const stats = plain(boot({ habits: [habit('a', [1])], completions: [done('a', '2026-11-23')] }).calculateWeeklyStats());
  assert.deepEqual([stats.totalScheduled, stats.totalCompleted, stats.percentage], [1, 1, 100]);
});

test('all seven weekdays are scheduled, but future days excluded', () => {
  const stats = plain(boot({ date: '2026-11-25', habits: [habit('a', [0,1,2,3,4,5,6])] }).calculateWeeklyStats());
  assert.equal(stats.totalScheduled, 3);
  assert.equal(stats.dailyStats.slice(3).reduce((sum, d) => sum + d.scheduled, 0), 0);
});

test('even recorded future completions do not count yet', () => {
  const stats = plain(boot({ habits: [habit('a', [1, 2])], completions: [done('a', '2026-11-24')] }).calculateWeeklyStats());
  assert.deepEqual([stats.totalScheduled, stats.totalCompleted], [1, 0]);
});

test('completion for another date does not mark today complete', () => {
  const stats = plain(boot({ habits: [habit('a', [1])], completions: [done('a', '2026-11-16')] }).calculateWeeklyStats());
  assert.equal(stats.totalCompleted, 0);
});

test('completion for unknown habit does not affect figures', () => {
  const stats = plain(boot({ habits: [habit('a', [1])], completions: [done('other', '2026-11-23')] }).calculateWeeklyStats());
  assert.equal(stats.totalCompleted, 0);
});

test('creation date prevents counting an activity before it exists', () => {
  const stats = plain(boot({ date: '2026-11-25', habits: [habit('a', [1, 2], '2026-11-25')] }).calculateWeeklyStats());
  assert.equal(stats.totalScheduled, 0);
});

test('history selects schedule effective for its exact date', () => {
  const h = habit('a', [2, 4], '2026-11-23', [
    { effectiveFrom: '2026-11-23', weekdays: [1, 3] },
    { effectiveFrom: '2026-11-25', weekdays: [2, 4] }
  ]);
  const f = boot();
  assert.deepEqual(plain(f.getWeekdaysForDate(h, '2026-11-24')), [1,3]);
  assert.deepEqual(plain(f.getWeekdaysForDate(h, '2026-11-25')), [2,4]);
});

test('historical schedules work even if entries are not sorted', () => {
  const h = habit('a', [5], '2026-11-23', [
    { effectiveFrom: '2026-11-27', weekdays: [5] },
    { effectiveFrom: '2026-11-23', weekdays: [1] },
    { effectiveFrom: '2026-11-25', weekdays: [3] }
  ]);
  assert.deepEqual(plain(boot().getWeekdaysForDate(h, '2026-11-26')), [3]);
});

test('no historical schedule before first effective date', () => {
  const h = habit('a', [1], '2026-11-23', [ { effectiveFrom: '2026-11-26', weekdays: [4] } ]);
  assert.deepEqual(plain(boot().getWeekdaysForDate(h, '2026-11-23')), []);
});

test('legacy habits without scheduleHistory fall back to weekdays', () => {
  assert.deepEqual(plain(boot().getWeekdaysForDate(habit('a', [1, 2]), '2026-11-23')), [1,2]);
});

test('changing a schedule does not rewrite Monday historical stats', () => {
  const h = habit('a', [2, 4], '2026-11-23', [
    { effectiveFrom: '2026-11-23', weekdays: [1, 3] },
    { effectiveFrom: '2026-11-25', weekdays: [2, 4] }
  ]);
  const s = plain(boot({ date: '2026-11-25', habits: [h], completions: [done('a', '2026-11-23')] }).calculateWeeklyStats());
  assert.equal(s.totalScheduled, 1);
  assert.equal(s.totalCompleted, 1);
  assert.equal(s.dailyStats[0].scheduled, 1);
  assert.equal(s.dailyStats[2].scheduled, 0);
});

test('percentage rounds for two of three activities', () => {
  const h = habit('a', [1, 2, 3]);
  const s = plain(boot({ date: '2026-11-25', habits: [h], completions: [done('a','2026-11-23'), done('a','2026-11-24')] }).calculateWeeklyStats());
  assert.deepEqual([s.totalScheduled, s.totalCompleted, s.percentage], [3, 2, 67]);
});

test('separate habits are counted independently', () => {
  const hs = [habit('a', [1]), habit('b', [1])];
  const s = plain(boot({ habits: hs, completions: [done('b', '2026-11-23')] }).calculateWeeklyStats());
  assert.deepEqual([s.totalScheduled, s.totalCompleted, s.percentage], [2, 1, 50]);
});
