
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
