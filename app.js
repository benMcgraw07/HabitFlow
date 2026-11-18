
/* =========================================
   HabitFlow - Application Logic
   ========================================= */

// Find the navigation buttons and screens
const navButtons = document.querySelectorAll(".nav-button");
const screens = document.querySelectorAll(".screen");

// Switch to the selected screen
function showScreen(screenId) {
    // Hide all screens
    screens.forEach((screen) => {
        screen.hidden = true;
    });

    // Show the requested screen
    const selectedScreen = document.getElementById(screenId);
    selectedScreen.hidden = false;
    // Refresh statistics whenever Progress is opened
    if (screenId === "progress-screen") {
        renderWeeklyProgress();
    }

    // Update the active navigation button
    navButtons.forEach((button) => {
        const isActive = button.dataset.screen === screenId;

        button.classList.toggle("active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

// Listen for navigation clicks
navButtons.forEach((button) => {
    button.addEventListener("click", () => {
        showScreen(button.dataset.screen);
    });
});

// Display today's date
const dateElement = document.getElementById("current-date");

dateElement.textContent = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
});

// Show Today by default
showScreen("today-screen");



/* =========================================
   HabitFlow - Habit Management
   ========================================= */

// Temporary habit storage (IndexedDB comes later)
let habits = [];
let completions = [];
let editingHabitId = null;


// Find the form elements
const addHabitButton = document.getElementById("add-habit-button");
const habitForm = document.getElementById("habit-form");
const habitNameInput = document.getElementById("habit-name");
const habitsList = document.getElementById("habits-list");
const cancelHabitButton = document.getElementById("cancel-habit-button");
const formError = document.getElementById("habit-form-error");

// Open the Add New Habit form

addHabitButton.addEventListener("click", () => {
    editingHabitId = null;

    habitForm.reset();
    formError.hidden = true;

    document.getElementById("form-title").textContent =
        "Add New Habit";

    document.getElementById("save-habit-button").textContent =
        "Save Habit";

    habitForm.hidden = false;
    addHabitButton.hidden = true;

    habitNameInput.focus();
});


// Close the form without saving

cancelHabitButton.addEventListener("click", () => {
    editingHabitId = null;

    habitForm.reset();
    formError.hidden = true;
    habitForm.hidden = true;
    addHabitButton.hidden = false;
});




/* Handle habit creation and editing */
habitForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const habitName = habitNameInput.value.trim();

    const selectedDays = Array.from(
        habitForm.querySelectorAll('input[name="weekdays"]:checked')
    ).map((checkbox) => Number(checkbox.value));

    // Validate user input
    if (!habitName || selectedDays.length === 0) {
        formError.textContent =
            "Enter a habit name and select at least one weekday.";
        formError.hidden = false;
        return;
    }

    let habitToSave;

    if (editingHabitId === null) {
        // Create a new habit
        habitToSave = {
            id: crypto.randomUUID(),
            name: habitName,
            weekdays: selectedDays,
            createdOn: getTodayDate()
            
        };
    } else {
        // Find the habit being edited
        const existingHabit = habits.find(
            (habit) => habit.id === editingHabitId
        );

        if (!existingHabit) {
            formError.textContent = "Habit not found.";
            formError.hidden = false;
            return;
        }

        // Preserve the existing ID
        habitToSave = {
            ...existingHabit,
            name: habitName,
            weekdays: selectedDays
        };
    }

    // Save to IndexedDB
    try {
        await saveHabitToDatabase(habitToSave);
    } catch (error) {
        console.error("Failed to save habit:", error);
        formError.textContent =
            "Unable to save habit. Please try again.";
        formError.hidden = false;
        return;
    }

    // Update the application's habit array
    if (editingHabitId === null) {
        habits.push(habitToSave);
    } else {
        const index = habits.findIndex(
            (habit) => habit.id === editingHabitId
        );

        habits[index] = habitToSave;
    }

    // Refresh the interface
    renderHabits();
    renderTodayHabits();

    // Reset the form
    editingHabitId = null;
    habitForm.reset();
    habitForm.hidden = true;
    addHabitButton.hidden = false;
    formError.hidden = true;
});



// Convert weekday numbers into readable names
function formatWeekdays(days) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return days
        .slice()
        .sort((a, b) => (a + 6) % 7 - (b + 6) % 7)
        .map((day) => dayNames[day])
        .join(", ");
}

// Display all saved habits

function renderHabits() {
    habitsList.replaceChildren();

    if (habits.length === 0) {
        const message = document.createElement("p");
        message.textContent = "You haven't added any habits yet.";
        habitsList.appendChild(message);
        return;
    }

    habits.forEach((habit) => {
        const card = document.createElement("div");
        card.className = "habit-card";

        // Habit information
        const details = document.createElement("div");

        const name = document.createElement("strong");
        name.textContent = habit.name;

        
        const schedule = document.createElement("div");
        schedule.className = "habit-schedule";

        // Display scheduled days in Monday-Sunday order
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        habit.weekdays
            .slice()
            .sort((a, b) => (a + 6) % 7 - (b + 6) % 7)
            .forEach((day) => {
                const badge = document.createElement("span");
                badge.className = "weekday-badge";
                badge.textContent = dayNames[day];

                schedule.appendChild(badge);
            });


        details.append(name, schedule);

        // Edit and Delete buttons
        const actions = document.createElement("div");
        actions.className = "habit-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => {
            editHabit(habit.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            deleteHabit(habit.id);
        });

        actions.append(editButton, deleteButton);
        card.append(details, actions);

        habitsList.appendChild(card);
    });
}


/* =========================================
   HabitFlow - Today Screen
   ========================================= */


function renderTodayHabits() {
    const container = document.getElementById("today-habits");
    const progressCount = document.getElementById("progress-count");
    const progressBar = document.getElementById("daily-progress-bar");

    const today = new Date().getDay();
    const date = getTodayDate();

    // Only habits scheduled for today
    const todayHabits = habits.filter((habit) =>
        habit.weekdays.includes(today)
    );

    container.replaceChildren();

    let completedCount = 0;

    if (todayHabits.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No habits scheduled for today.";
        container.appendChild(message);
    }

    todayHabits.forEach((habit) => {
        const completionId = `${habit.id}_${date}`;

        const isCompleted = completions.some(
            (completion) => completion.id === completionId
        );

        if (isCompleted) {
            completedCount++;
        }

        // Create the habit card
        const card = document.createElement("div");
        card.className = "habit-card";

        const label = document.createElement("label");
        label.className = "completion-label";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isCompleted;

        const name = document.createElement("span");
        name.textContent = habit.name;

        // Save changes when the checkbox is toggled
        checkbox.addEventListener("change", async () => {
            checkbox.disabled = true;

            try {
                await updateCompletionInDatabase(
                    habit.id,
                    date,
                    checkbox.checked
                );

                // Reload the completion records
                completions = await loadCompletionsFromDatabase();

                // Refresh today's progress
                renderTodayHabits();

            } catch (error) {
                console.error("Failed to update completion:", error);

                checkbox.checked = !checkbox.checked;

                alert("Unable to update habit completion.");
            } finally {
                checkbox.disabled = false;
            }
        });

        label.append(checkbox, name);
        card.appendChild(label);
        container.appendChild(card);
    });

    // Update daily progress
    progressCount.textContent =
        `${completedCount}/${todayHabits.length}`;

    progressBar.max = Math.max(todayHabits.length, 1);
    progressBar.value = completedCount;
}



// Display the empty state when the app first loads
renderHabits();
renderTodayHabits();



// Edit an existing habit
function editHabit(habitId) {
    const habit = habits.find(
        (habit) => habit.id === habitId
    );

    if (!habit) return;

    editingHabitId = habitId;

    // Fill the form with existing values
    habitForm.reset();
    habitNameInput.value = habit.name;

    habitForm.querySelectorAll('input[name="weekdays"]')
        .forEach((checkbox) => {
            checkbox.checked = habit.weekdays.includes(
                Number(checkbox.value)
            );
        });

    // Update the form heading and button
    document.getElementById("form-title").textContent =
        "Edit Habit";

    document.getElementById("save-habit-button").textContent =
        "Save Changes";

    formError.hidden = true;
    habitForm.hidden = false;
    addHabitButton.hidden = true;

    habitNameInput.focus();
}

// Delete an existing habit


async function deleteHabit(habitId) {
    const habit = habits.find(
        (habit) => habit.id === habitId
    );

    if (!habit) return;

    // Ask the user to confirm deletion
    const confirmed = confirm(
        `Are you sure you want to delete "${habit.name}"?`
    );

    if (!confirmed) return;

    try {
        // Delete the habit and its completions from IndexedDB
        await deleteHabitFromDatabase(habitId);

        // Remove the habit from memory
        habits = habits.filter(
            (habit) => habit.id !== habitId
        );

        // Remove its completion records from memory
        completions = completions.filter(
            (completion) => completion.habitId !== habitId
        );

        // Close the form if this habit was being edited
        if (editingHabitId === habitId) {
            editingHabitId = null;
            habitForm.reset();
            habitForm.hidden = true;
            addHabitButton.hidden = false;
        }

        // Refresh all affected screens
        renderHabits();
        renderTodayHabits();
        renderWeeklyProgress();

    } catch (error) {
        console.error("Failed to delete habit:", error);
        alert("Unable to delete habit. Please try again.");
    }
}





/* =========================================
   IndexedDB - Local Database
   ========================================= */



const DB_NAME = "HabitFlowDB";
const DB_VERSION = 3;

const HABIT_STORE = "habits";
const COMPLETION_STORE = "completions";



let db = null;

// Open or create the database
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Runs when the database is first created
        
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains(HABIT_STORE)) {
                database.createObjectStore(HABIT_STORE, {
                    keyPath: "id"
                });
            }

            if (!database.objectStoreNames.contains(COMPLETION_STORE)) {
                database.createObjectStore(COMPLETION_STORE, {
                    keyPath: "id"
                });
            }
        };



        // Database opened successfully
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        // Something went wrong
        request.onerror = () => {
            reject(request.error);
        };
    });
}


/* =========================================
   IndexedDB - Save Habit
   ========================================= */

function saveHabitToDatabase(habit) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            HABIT_STORE,
            "readwrite"
        );

        const store = transaction.objectStore(HABIT_STORE);

        // Add a new habit or update an existing one
        store.put(habit);

        // Resolve only when the transaction has completed
        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(transaction.error);
        };
    });
}



/* =========================================
   IndexedDB - Delete Habit
   ========================================= */


function deleteHabitFromDatabase(habitId) {
    return new Promise((resolve, reject) => {
        // Access both stores in one transaction
        const transaction = db.transaction(
            [HABIT_STORE, COMPLETION_STORE],
            "readwrite"
        );

        const habitStore = transaction.objectStore(HABIT_STORE);
        const completionStore = transaction.objectStore(COMPLETION_STORE);

        // Delete the habit
        habitStore.delete(habitId);

        // Delete all associated completion records
        const request = completionStore.openCursor();

        request.onsuccess = () => {
            const cursor = request.result;

            if (cursor) {
                if (cursor.value.habitId === habitId) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };

        transaction.oncomplete = () => resolve();

        transaction.onerror = () => reject(transaction.error);

        transaction.onabort = () => reject(
            transaction.error || new Error("Delete transaction aborted")
        );
    });
}




/* =========================================
   IndexedDB - Load Habits
   ========================================= */

function loadHabitsFromDatabase() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            HABIT_STORE,
            "readonly"
        );

        const store = transaction.objectStore(HABIT_STORE);

        // Retrieve every saved habit
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}


/* =========================================
   HabitFlow - Completion Tracking
   ========================================= */

// Get today's date in local YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Save or remove a completion in IndexedDB
function updateCompletionInDatabase(habitId, date, completed) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            COMPLETION_STORE,
            "readwrite"
        );

        const store = transaction.objectStore(COMPLETION_STORE);

        // Unique record for each habit and date
        const completionId = `${habitId}_${date}`;

        if (completed) {
            store.put({
                id: completionId,
                habitId: habitId,
                date: date
            });
        } else {
            store.delete(completionId);
        }

        transaction.oncomplete = () => resolve();

        transaction.onerror = () => reject(transaction.error);

        transaction.onabort = () => reject(transaction.error);
    });
}


/* =========================================
   IndexedDB - Load Completions
   ========================================= */

function loadCompletionsFromDatabase() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            COMPLETION_STORE,
            "readonly"
        );

        const store = transaction.objectStore(COMPLETION_STORE);

        // Retrieve all saved completion records
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}


/* =========================================
   HabitFlow - Weekly Progress
   ========================================= */

function getCurrentWeekDates() {
    const today = new Date();

    // Start at midnight today
    const monday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    // Move backwards to Monday
    const daysSinceMonday = (today.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysSinceMonday);

    const weekDates = [];

    // Generate Monday through Sunday
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        weekDates.push({
            date: `${year}-${month}-${day}`,
            weekday: date.getDay(),
            label: date.toLocaleDateString("en-GB", {
                weekday: "short"
            }),
            isFuture: date > today
        });
    }

    return weekDates;
}


/* =========================================
   HabitFlow - Weekly Statistics
   ========================================= */

function calculateWeeklyStats() {
    const weekDates = getCurrentWeekDates();
    const today = getTodayDate();

    let totalScheduled = 0;
    let totalCompleted = 0;

    // Look up completed habit/date combinations
    const completedIds = new Set(
        completions.map((completion) => completion.id)
    );

    const dailyStats = weekDates.map((day) => {
        // Future days do not count towards progress
        if (day.isFuture) {
            return {
                ...day,
                scheduled: 0,
                completed: 0
            };
        }

        // Find habits scheduled for this day
        const scheduledHabits = habits.filter((habit) => {
            const createdOn = habit.createdOn || today;

            return (
                habit.weekdays.includes(day.weekday) &&
                day.date >= createdOn
            );
        });

        // Count completed habits
        const completedCount = scheduledHabits.filter((habit) =>
            completedIds.has(`${habit.id}_${day.date}`)
        ).length;

        totalScheduled += scheduledHabits.length;
        totalCompleted += completedCount;

        return {
            ...day,
            scheduled: scheduledHabits.length,
            completed: completedCount
        };
    });

    // Avoid division by zero
    const percentage = totalScheduled > 0
        ? Math.round((totalCompleted / totalScheduled) * 100)
        : 0;

    return {
        totalScheduled,
        totalCompleted,
        percentage,
        dailyStats
    };
}


/* =========================================
   HabitFlow - Progress Dashboard
   ========================================= */

function renderWeeklyProgress() {
    // Calculate the latest weekly statistics
    const stats = calculateWeeklyStats();

    const statisticsContainer =
        document.getElementById("weekly-statistics");

    // Clear the previous statistics
    statisticsContainer.replaceChildren();

    // Create the weekly overview card
    const card = document.createElement("div");
    card.className = "weekly-summary-card";

    const heading = document.createElement("h3");
    heading.textContent = "Weekly Overview";

    const percentage = document.createElement("p");
    percentage.className = "weekly-percentage";
    percentage.textContent =
        `${stats.percentage}% completion`;

    const summary = document.createElement("p");
    summary.textContent =
        `${stats.totalCompleted}/${stats.totalScheduled} scheduled activities completed`;

    // Add everything to the Progress screen
    card.append(heading, percentage, summary);
    statisticsContainer.appendChild(card);
    renderWeeklyChart();
}


/* =========================================
   HabitFlow - Weekly Progress Chart
   ========================================= */

function renderWeeklyChart() {
    const chartContainer = document.getElementById("weekly-chart");

    const stats = calculateWeeklyStats();

    chartContainer.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Daily Completion";

    const chart = document.createElement("div");
    chart.className = "weekly-chart";

    stats.dailyStats.forEach((day) => {
        const dayColumn = document.createElement("div");
        dayColumn.className = "chart-day";

        // Calculate percentage for this day
        const percentage = day.scheduled > 0
            ? (day.completed / day.scheduled) * 100
            : 0;

        // Create the vertical bar container
        const barContainer = document.createElement("div");
        barContainer.className = "chart-column";

        if (day.isFuture) {
            barContainer.classList.add("future");
        }

        const bar = document.createElement("div");
        bar.className = "chart-bar";
        bar.style.height = `${percentage}%`;
        bar.setAttribute("aria-hidden", "true");

        // Describe the bar for screen readers
        const description = day.isFuture
            ? "Upcoming"
            : day.scheduled === 0
                ? "No habits scheduled"
                : `${day.completed} of ${day.scheduled} completed`;

        barContainer.setAttribute("role", "img");
        barContainer.setAttribute(
            "aria-label",
            `${day.label}: ${description}`
        );

        barContainer.appendChild(bar);

        // Weekday label
        const dayLabel = document.createElement("span");
        dayLabel.className = "chart-label";
        dayLabel.textContent = day.label;

        // Completed / scheduled label
        const countLabel = document.createElement("small");
        countLabel.className = "chart-count";

        countLabel.textContent = day.isFuture || day.scheduled === 0
            ? "—"
            : `${day.completed}/${day.scheduled}`;

        dayColumn.append(barContainer, dayLabel, countLabel);
        chart.appendChild(dayColumn);
    });

    chartContainer.append(heading, chart);
}




/* =========================================
   Application Initialisation
   ========================================= */

async function initialiseApp() {
    try {
        // Open IndexedDB
        await openDatabase();

        console.log("HabitFlow database opened successfully!");

        // Load saved habits
        habits = await loadHabitsFromDatabase();

        // Load completion history
        completions = await loadCompletionsFromDatabase();

        // Update the interface
        renderHabits();
        renderTodayHabits();

        console.log(`Loaded ${habits.length} habits from IndexedDB`);
        console.log(`Loaded ${completions.length} completions from IndexedDB`);

    } catch (error) {
        console.error("Failed to initialise HabitFlow:", error);
    }
}

initialiseApp();



/* =========================================
   HabitFlow - Settings: Dark Mode
   ========================================= */

const darkModeToggle = document.getElementById("dark-mode-toggle");

// Restore the user's saved preference
const savedTheme = localStorage.getItem("habitflow-theme");

if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    darkModeToggle.checked = true;
}

// Listen for changes to the checkbox
darkModeToggle.addEventListener("change", () => {
    const darkModeEnabled = darkModeToggle.checked;

    // Apply or remove the dark theme
    document.body.classList.toggle("dark-mode", darkModeEnabled);

    // Remember the preference after refreshing
    localStorage.setItem(
        "habitflow-theme",
        darkModeEnabled ? "dark" : "light"
    );
});


/* =========================================
   HabitFlow - Settings: Export Data
   ========================================= */

const exportDataButton = document.getElementById("export-data-button");

exportDataButton.addEventListener("click", async () => {
    try {
        // Read the latest saved records from IndexedDB
        const savedHabits = await loadHabitsFromDatabase();
        const savedCompletions = await loadCompletionsFromDatabase();

        // Organise the data for export
        const backup = {
            app: "HabitFlow",
            exportedAt: new Date().toISOString(),
            habits: savedHabits,
            completions: savedCompletions
        };

        // Convert the data to formatted JSON
        const json = JSON.stringify(backup, null, 2);

        // Create a downloadable file
        const blob = new Blob([json], {
            type: "application/json"
        });

        const url = URL.createObjectURL(blob);

        // Trigger the download
        const link = document.createElement("a");
        link.href = url;
        link.download = `habitflow-backup-${getTodayDate()}.json`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        // Release the temporary file URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (error) {
        console.error("Failed to export habit data:", error);
        alert("Unable to export habit data. Please try again.");
    }
});


/* =========================================
   HabitFlow - Settings: Reset Progress
   ========================================= */

const resetProgressButton = document.getElementById("reset-progress-button");

resetProgressButton.addEventListener("click", async () => {
    // Confirm before deleting completion history
    const confirmed = confirm(
        "Reset all progress? This will permanently delete all completion history, but keep your habits."
    );

    if (!confirmed) return;

    resetProgressButton.disabled = true;

    try {
        // Delete all completion records from IndexedDB
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(
                COMPLETION_STORE,
                "readwrite"
            );

            const store = transaction.objectStore(COMPLETION_STORE);

            store.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });

        // Clear the completion records held in memory
        completions = [];

        // Refresh the screens
        renderTodayHabits();
        renderWeeklyProgress();

        alert("All progress has been reset successfully.");

    } catch (error) {
        console.error("Failed to reset progress:", error);
        alert("Unable to reset progress. Please try again.");

    } finally {
        resetProgressButton.disabled = false;
    }
});
//V0.6


/* =========================================
   HabitFlow - Service Worker Registration
   ========================================= */

if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            const registration = await navigator.serviceWorker.register(
                "./service-worker.js"
            );

            console.log(
                "HabitFlow service worker registered:",
                registration.scope
            );
        } catch (error) {
            console.error(
                "Service worker registration failed:",
                error
            );
        }
    });
}
