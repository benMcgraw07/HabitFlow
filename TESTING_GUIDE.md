# HabitFlow — Evidence-based testing pack (23 November 2026)

This repository includes the HabitFlow application, reproducible automated tests, and documented accessibility improvements. The application has been tested using Node.js unit tests, Chromium integration tests, and Lighthouse audits.

## 1. Logic tests (already executed in this audit)

Requires Node.js 18 or newer. Open a terminal in `HabitFlow_Folder`:

```bash
node --test tests/logic.test.cjs
```

On 23 November 2026, **21/21 passed** in the assessment environment (Node 22). The saved output is in `tests/logic_results_2026-11-23.txt`. They read the *actual* function declarations from `app.js` and exercise date boundaries, schedule history, and weekly statistics. They do **not** test IndexedDB or notification delivery.

## 2. Real-browser integration tests (Executed 23 November 2026)

All 10 Chromium integration tests passed on 23 November 2026 in the original HabitFlow repository. Tests included IndexedDB persistence, habit operations, historical schedules, JSON export, dark mode and offline application loading.

```bash
python -m pip install playwright
python -m playwright install chromium
```

From `HabitFlow_Folder` run:

```bash
python -m unittest discover -s tests -p 'browser_*.py' -v
```

For Windows, you can use `py` instead of `python` if that's how Python is installed.

The browser checks cover navigation, database writes, reload persistence, completion tracking, editing, deletion, reset, export, dark mode and offline cached launch. **Do not mark these as passed unless they successfully run on your computer.**

The browser integration suite was successfully executed on Windows using Playwright and Chromium. The tests exercised real IndexedDB operations, application navigation, persistence, editing, deletion, JSON export, dark mode and offline cached loading.

## 3. Manual test matrix (results not yet recorded)

`tests/manual_test_matrix.csv` contains 32 cases and blank columns for actual results, status, device, time and screenshots. Run relevant high-priority tests on your iPhone (and desktop browser where applicable), then record the **actual** result. Do not pre-fill passes. Some historical tests require an existing history record or a controlled test dataset.

## 4. Scope and limits

- Unit tests: executed in this audit, all passed.
- Chromium integration: 10/10 tests passed on 23 November 2026 in the original HabitFlow repository.
- iPhone Safari/PWA: manual testing required.
- Notifications: must be tested through deployed GitHub Pages origin and live OneSignal/GitHub logs, not localhost.
- Performance and accessibility: require measurements and retesting after fixes.
- Application improvements: Updated text contrast in style.css and added a favicon reference in index.html. Core application logic in app.js remains unchanged.

For your coursework report, distinguish this new test suite (created 23 November) from the *original* eight Node.js tests and 32 claimed manual scenarios. Those older artefacts were not present in the ZIP. Never present unexecuted test cases as successes.
