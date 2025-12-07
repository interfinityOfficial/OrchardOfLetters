const logoutButton = document.getElementById('logout-button');
const alert = document.querySelector('.alert');
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

alertButtonSecondary.addEventListener('click', hideAlert);
alertButtonPrimary.addEventListener('click', logout);

// Redirect to the logout endpoint
function logout() {
    window.location.href = '/logout/';
}

if (logoutButton) {
    logoutButton.addEventListener('click', showAlert);
}