async function loginWithPasskey(username) {
    const opts = await fetch("/login-request/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
    })
        .then(r => r.json())
    if (opts.error || opts.options?.error) {
        const err = opts.error || opts.options.error;
        showError(err);
        return;
    }

    try {
        const attResp = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: opts.options });
        await fetch("/login-response/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: opts.userId, authenticationResponse: attResp })
        }).then(response => response.json()).then(response => {
            if (response.error) {
                showError(response.error);
                return;
            }
            window.location.href = "/plant/";
        });
    } catch (err) {
        showError("Failed to login with passkey");
        return;
    }
}

const errorText = document.getElementById("error-text");

const resizeObserver = new ResizeObserver(entries => {
    document.documentElement.style.setProperty('--error-text-height', errorText.scrollHeight + 'px');
});
resizeObserver.observe(document.documentElement);
document.documentElement.style.setProperty('--error-text-height', errorText.scrollHeight + 'px');

function showError(message) {
    errorText.innerHTML = message;
    document.documentElement.style.setProperty('--error-text-height', errorText.scrollHeight + 'px');
    document.body.classList.add("show-error");
}

const loginButton = document.getElementById("login-button");
const usernameInput = document.getElementById("username-input");

loginButton.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    if (!username) {
        showError("Please enter your username");
        return;
    }
    await loginWithPasskey(username);
});

// Allow pressing Enter to submit
usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        loginButton.click();
    }

    document.body.classList.remove("show-error");
});
