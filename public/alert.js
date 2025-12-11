const logoutButton = document.getElementById('logout-button');
const resetButton = document.getElementById('reset-button');

const alert = document.getElementById('alert');
const alertContentText = document.getElementById('alert-content-text');
const alertButtonSecondary = document.getElementById('alert-button-secondary');
const alertButtonPrimary = document.getElementById('alert-button-primary');

// Open the confirmation alert
function showAlert() {
    alert.classList.add('alert-on');
}

// Close the confirmation alert
function hideAlert() {
    alert.classList.remove('alert-on');
}

// Redirect to the logout endpoint
function logout() {
    window.location.href = '/logout/';
}

function reset() {
    fetch('/reset/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            plantId: window.PLANT_DATA.plantId,
        }),
    })
        .then(response => response.json())
        .then(data => {
            location.href = '/';
        })
        .catch(error => {
            location.reload();
        });
}

if (logoutButton) {

    logoutButton.addEventListener('click', () => {
        alertContentText.textContent = 'Confirm Logout?';
        alertButtonSecondary.textContent = 'Cancel';
        alertButtonPrimary.textContent = 'Logout';
        alertButtonSecondary.onclick = hideAlert;
        alertButtonPrimary.onclick = logout;
        showAlert();
    });
}

if (resetButton) {
    resetButton.addEventListener('click', () => {
        alertContentText.textContent = 'Confirm Reset?';
        alertButtonSecondary.textContent = 'Cancel';
        alertButtonPrimary.textContent = 'Reset';
        alertButtonSecondary.onclick = hideAlert;
        alertButtonPrimary.onclick = reset;
        showAlert();
    });
}