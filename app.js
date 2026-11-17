
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
            weekdays: selectedDays
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

        const schedule = document.createElement("p");
        schedule.textContent = formatWeekdays(habit.weekdays);
        schedule.className = "habit-schedule";

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


// Display the empty state when the app first loads
renderHabits();



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

    const confirmed = confirm(
        `Are you sure you want to delete "${habit.name}"?`
    );

    if (!confirmed) return;

    try {
        // First, delete from IndexedDB
        await deleteHabitFromDatabase(habitId);

        // Then update the application's array
        habits = habits.filter(
            (habit) => habit.id !== habitId
        );

        // Close the form if necessary
        if (editingHabitId === habitId) {
            editingHabitId = null;
            habitForm.reset();
            habitForm.hidden = true;
            addHabitButton.hidden = false;
        }

        // Update the screen
        renderHabits();

    } catch (error) {
        console.error("Failed to delete habit:", error);
        alert("Unable to delete habit. Please try again.");
    }
}




/* =========================================
   IndexedDB - Local Database
   ========================================= */

const DB_NAME = "HabitFlowDB";
const DB_VERSION = 1;
const HABIT_STORE = "habits";

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
        const transaction = db.transaction(
            HABIT_STORE,
            "readwrite"
        );

        const store = transaction.objectStore(HABIT_STORE);

        // Delete the habit using its unique ID
        store.delete(habitId);

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
   Application Initialisation
   ========================================= */

async function initialiseApp() {
    try {
        // Open the IndexedDB database
        await openDatabase();

        console.log("HabitFlow database opened successfully!");

        // Load saved habits into our JavaScript array
        habits = await loadHabitsFromDatabase();

        // Display the loaded habits
        renderHabits();

        console.log(`Loaded ${habits.length} habits from IndexedDB`);

    } catch (error) {
        console.error("Failed to initialise HabitFlow:", error);
    }
}

initialiseApp();

