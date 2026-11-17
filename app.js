
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

// Find the form elements
const addHabitButton = document.getElementById("add-habit-button");
const habitForm = document.getElementById("habit-form");
const habitNameInput = document.getElementById("habit-name");
const habitsList = document.getElementById("habits-list");
const cancelHabitButton = document.getElementById("cancel-habit-button");
const formError = document.getElementById("habit-form-error");

// Open the Add New Habit form
addHabitButton.addEventListener("click", () => {
    habitForm.reset();
    formError.hidden = true;
    habitForm.hidden = false;
    addHabitButton.hidden = true;
    habitNameInput.focus();
});

// Close the form without saving
cancelHabitButton.addEventListener("click", () => {
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

    // Create a new habit object
    const newHabit = {
        id: crypto.randomUUID(),
        name: habitName,
        weekdays: selectedDays
    };

    habits.push(newHabit);

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

        const details = document.createElement("div");

        const name = document.createElement("strong");
        name.textContent = habit.name;

        const schedule = document.createElement("p");
        schedule.textContent = formatWeekdays(habit.weekdays);
        schedule.className = "habit-schedule";

        details.append(name, schedule);
        card.appendChild(details);
        habitsList.appendChild(card);
    });
}

// Display the empty state when the app first loads
renderHabits();
