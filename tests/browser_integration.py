"""Real-browser HabitFlow integration tests (to run on user's computer).

Requirements: pip install playwright && python -m playwright install chromium
From HabitFlow_Folder: python -m unittest discover -s tests -p 'browser_*.py' -v

These tests use a localhost HTTP server, a real Chromium browser, real IndexedDB,
real service-worker registration, and a fresh isolated browser profile per test.
They do NOT test OneSignal on the deployed GitHub Pages origin, mobile Safari,
or notification delivery. They have NOT been run in the assessment sandbox.
"""
import functools
import http.server
import json
import pathlib
import threading
import unittest
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

class HabitFlowBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(QuietHandler, directory=str(ROOT))
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(accept_downloads=True, viewport={"width": 390, "height": 844})
        self.page = self.context.new_page()
        # Push is deliberately disabled for localhost by the app itself. Stub
        # only the remote SDK request to avoid dependence on network access.
        self.page.route("https://cdn.onesignal.com/**", lambda route: route.fulfill(status=200, body=""))
        self.open_app()

    def tearDown(self):
        self.context.close()

    def open_app(self):
        self.page.goto(self.url, wait_until="domcontentloaded")
        self.page.wait_for_function("() => typeof db !== 'undefined' && db !== null", timeout=15000)

    def nav(self, screen):
        self.page.locator(f'.nav-button[data-screen="{screen}-screen"]').click()

    def add_today_habit(self, name="Read for 20 minutes"):
        self.nav("habits")
        self.page.locator("#add-habit-button").click()
        self.page.locator("#habit-name").fill(name)
        js_day = datetime.now().isoweekday() % 7  # Sunday=0, Monday=1
        self.page.locator(f'input[name="weekdays"][value="{js_day}"]').check()
        self.page.locator("#save-habit-button").click()
        expect(self.page.locator("#habits-list .habit-card strong")).to_have_text(name)

    def db_records(self, store):
        return self.page.evaluate("""async (store) => new Promise((resolve, reject) => {
            const req = db.transaction(store, 'readonly').objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error?.message);
        })""", store)

    def test_01_navigation_and_empty_state(self):
        expect(self.page.locator("#progress-count")).to_have_text("0/0")
        self.nav("habits")
        expect(self.page.locator("#habits-list")).to_contain_text("haven't added")
        self.nav("progress")
        expect(self.page.locator("#weekly-statistics")).to_contain_text("0/0")

    def test_02_add_habit_and_real_indexeddb(self):
        self.add_today_habit()
        records = self.db_records("habits")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["name"], "Read for 20 minutes")
        self.assertEqual(len(records[0]["scheduleHistory"]), 1)

    def test_03_reload_preserves_habit(self):
        self.add_today_habit()
        self.open_app()
        self.nav("habits")
        expect(self.page.locator("#habits-list .habit-card strong")).to_have_text("Read for 20 minutes")

    def test_04_completion_updates_weekly_stats_and_persists(self):
        self.add_today_habit()
        self.nav("today")
        self.page.locator("#today-habits input[type=checkbox]").check()
        expect(self.page.locator("#progress-count")).to_have_text("1/1")
        self.nav("progress")
        expect(self.page.locator("#weekly-statistics")).to_contain_text("100% completion")
        self.assertEqual(len(self.db_records("completions")), 1)
        self.open_app()
        expect(self.page.locator("#progress-count")).to_have_text("1/1")

    def test_05_edit_preserves_identity_and_schedule_history(self):
        self.add_today_habit()
        original = self.db_records("habits")[0]
        self.page.locator("#habits-list .habit-card button", has_text="Edit").click()
        self.page.locator("#habit-name").fill("Exercise")
        self.page.locator("#save-habit-button").click()
        changed = self.db_records("habits")[0]
        self.assertEqual(changed["id"], original["id"])
        self.assertEqual(changed["name"], "Exercise")
        self.assertEqual(changed["scheduleHistory"], original["scheduleHistory"])

    def test_06_deletion_clears_related_completions(self):
        self.add_today_habit()
        self.nav("today")
        self.page.locator("#today-habits input[type=checkbox]").check()
        expect(self.page.locator("#progress-count")).to_have_text("1/1")
        self.nav("habits")
        self.page.once("dialog", lambda dialog: dialog.accept())
        self.page.locator("#habits-list .habit-card button", has_text="Delete").click()
        expect(self.page.locator("#habits-list")).to_contain_text("haven't added")
        self.assertEqual(self.db_records("habits"), [])
        self.assertEqual(self.db_records("completions"), [])

    def test_07_reset_progress_keeps_habits(self):
        self.add_today_habit()
        self.nav("today")
        self.page.locator("#today-habits input[type=checkbox]").check()
        expect(self.page.locator("#progress-count")).to_have_text("1/1")
        self.nav("settings")
        self.page.on("dialog", lambda dialog: dialog.accept())
        self.page.locator("#reset-progress-button").click()
        self.page.wait_for_function("() => !document.getElementById('reset-progress-button').disabled")
        self.assertEqual(len(self.db_records("habits")), 1)
        self.assertEqual(len(self.db_records("completions")), 0)

    def test_08_dark_mode_survives_reload(self):
        self.nav("settings")
        self.page.locator("#dark-mode-toggle").check()
        expect(self.page.locator("body")).to_have_class("dark-mode")
        self.open_app()
        expect(self.page.locator("body")).to_have_class("dark-mode")
        self.nav("settings")
        self.assertTrue(self.page.locator("#dark-mode-toggle").is_checked())

    def test_09_export_contains_saved_data(self):
        self.add_today_habit()
        self.nav("settings")
        with self.page.expect_download() as capture:
            self.page.locator("#export-data-button").click()
        downloaded = capture.value
        self.assertTrue(downloaded.suggested_filename.endswith(".json"))
        with open(downloaded.path(), "r", encoding="utf8") as f:
            data = json.load(f)
        self.assertEqual(data["app"], "HabitFlow")
        self.assertEqual(len(data["habits"]), 1)

    def test_10_offline_cached_app_launches(self):
        self.add_today_habit()
        # Wait for the service worker install and confirm it controls the page.
        self.page.evaluate("async () => { await navigator.serviceWorker.ready; }")
        self.page.reload(wait_until="domcontentloaded")
        self.page.wait_for_function("() => navigator.serviceWorker.controller !== null", timeout=15000)
        self.context.set_offline(True)
        self.page.reload(wait_until="domcontentloaded")
        self.page.wait_for_function("() => typeof db !== 'undefined' && db !== null")
        self.nav("habits")
        expect(self.page.locator("#habits-list .habit-card strong")).to_have_text("Read for 20 minutes")

    def test_11_weekday_edit_preserves_prior_week_in_indexeddb(self):
        """Seed an older habit in real IndexedDB, then edit using the real UI."""
        self.add_today_habit("Historical regression check")

        # A new UI habit cannot have dates in the past. Set up an older
        # fixture in IndexedDB, while testing the ACTUAL edit flow via UI.
        self.page.evaluate("""async () => {
            const req = db.transaction('habits', 'readonly')
                          .objectStore('habits').getAll();
            const rows = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            const habit = rows[0];
            const prevMonday = getCurrentWeekDates(-1)[0].date;
            habit.createdOn = prevMonday;
            habit.weekdays = [1, 3]; // Last week: Monday and Wednesday
            habit.scheduleHistory = [{
                effectiveFrom: prevMonday,
                weekdays: [1, 3]
            }];
            await saveHabitToDatabase(habit);
            await updateCompletionInDatabase(habit.id, prevMonday, true);
        }""")

        # Reload to ensure data comes from IndexedDB, not in-memory state.
        self.open_app()
        self.nav("progress")
        self.page.locator("#previous-week-button").click()
        expected = "1/2 scheduled activities completed"
        expect(self.page.locator("#weekly-statistics")).to_contain_text(expected)
        expect(self.page.locator("#weekly-statistics")).to_contain_text("50% completion")

        # Edit the schedule via actual form controls, not by modifying JS state.
        self.nav("habits")
        self.page.locator("#habits-list .habit-card button", has_text="Edit").click()
        self.page.locator('input[name="weekdays"][value="1"]').uncheck()
        self.page.locator('input[name="weekdays"][value="3"]').uncheck()
        self.page.locator('input[name="weekdays"][value="2"]').check()
        self.page.locator("#save-habit-button").click()

        record = self.db_records("habits")[0]
        self.assertEqual(record["weekdays"], [2])
        self.assertEqual(len(record["scheduleHistory"]), 2)
        self.assertEqual(record["scheduleHistory"][0]["weekdays"], [1, 3])
        self.assertEqual(record["scheduleHistory"][1]["weekdays"], [2])

        # Progress screen retains its selected week while switching tabs.
        # We were already viewing last week before editing.
        self.nav("progress")
        expect(self.page.locator("#weekly-statistics")).to_contain_text(expected)
        expect(self.page.locator("#weekly-statistics")).to_contain_text("50% completion")
        self.open_app()
        self.nav("progress")
        self.page.locator("#previous-week-button").click()
        expect(self.page.locator("#weekly-statistics")).to_contain_text(expected)
        expect(self.page.locator("#weekly-statistics")).to_contain_text("50% completion")
        self.assertEqual(len(self.db_records("completions")), 1)

if __name__ == "__main__":
    unittest.main(verbosity=2)
