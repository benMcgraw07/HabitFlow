
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


// Handle form submission
habitForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const habitName = habitNameInput.value.trim();

    // Get all selected weekday values
    const selectedDays = Array.from(
        habitForm.querySelectorAll('input[name="weekdays"]:checked')
    ).map((checkbox) => Number(checkbox.value));

    // Validate the input
    if (!habitName || selectedDays.length === 0) {
        formError.textContent = "Enter a habit name and select at least one weekday.";
        formError.hidden = false;
        return;
    }

    // Create a new habit object or edit habit object

    if (editingHabitId === null) {
        // ADD: Create a new habit
        const newHabit = {
            id: crypto.randomUUID(),
            name: habitName,
            weekdays: selectedDays
        };

        habits.push(newHabit);
    } else {
        // EDIT: Update the existing habit
        const habit = habits.find(
            (habit) => habit.id === editingHabitId
        );

        if (habit) {
            habit.name = habitName;
            habit.weekdays = selectedDays;
        }
    }

    // Clear editing mode
    editingHabitId = null;


    // Update the screen
    renderHabits();

    // Reset and close the form
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
function deleteHabit(habitId) {
    const habit = habits.find(
        (habit) => habit.id === habitId
    );

    if (!habit) return;

    // Ask for confirmation before deleting
    const confirmed = confirm(
        `Are you sure you want to delete "${habit.name}"?`
    );

    if (!confirmed) return;

    habits = habits.filter(
        (habit) => habit.id !== habitId
    );

    // Close the form if this habit was being edited
    if (editingHabitId === habitId) {
        editingHabitId = null;
        habitForm.reset();
        habitForm.hidden = true;
        addHabitButton.hidden = false;
    }

    renderHabits();
}
