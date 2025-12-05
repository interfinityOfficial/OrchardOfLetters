// Alert
const logoutButton = document.getElementById('logout-button');
const alert = document.querySelector('.alert');
const alertButtonSecondary = document.getElementById('alert-button-secondary');
const alertButtonPrimary = document.getElementById('alert-button-primary');

function showAlert() {
    alert.classList.add('alert-on');
}

function hideAlert() {
    alert.classList.remove('alert-on');
}

alertButtonSecondary.addEventListener('click', hideAlert);
alertButtonPrimary.addEventListener('click', logout);

function logout() {
    window.location.href = '/logout/';
}

logoutButton.addEventListener('click', showAlert);