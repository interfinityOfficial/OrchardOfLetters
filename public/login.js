// Track if conditional UI is active to avoid conflicts
let conditionalUIActive = false;
let conditionalUIAbortController = null;

// Start WebAuthn authentication for the given username
async function loginWithPasskey(username) {
    // Abort conditional UI if active to avoid conflicts
    if (conditionalUIAbortController) {
        conditionalUIAbortController.abort();
        conditionalUIAbortController = null;
    }

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

// Start conditional UI (passkey autofill) if supported
async function startConditionalUI() {
    // Check if conditional UI is supported
    if (!SimpleWebAuthnBrowser.browserSupportsWebAuthnAutofill ||
        !(await SimpleWebAuthnBrowser.browserSupportsWebAuthnAutofill())) {
        return;
    }

    try {
        // Get authentication options for autofill
        const opts = await fetch("/login-autofill-request/").then(r => r.json());
        if (opts.error) {
            console.warn("Failed to get autofill options:", opts.error);
            return;
        }

        conditionalUIActive = true;
        conditionalUIAbortController = new AbortController();

        // Start authentication with autofill enabled
        const authResp = await SimpleWebAuthnBrowser.startAuthentication({
            optionsJSON: opts.options,
            useBrowserAutofill: true,
            signal: conditionalUIAbortController.signal
        });

        conditionalUIActive = false;

        // Submit the response
        const response = await fetch("/login-response/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                authenticationResponse: authResp,
                isAutofill: true
            })
        }).then(r => r.json());

        if (response.error) {
            showError(response.error);
            return;
        }

        window.location.href = "/plant/";
    } catch (err) {
        conditionalUIActive = false;
        // AbortError is expected when user starts manual login
        if (err.name !== "AbortError") {
            console.warn("Conditional UI error:", err);
        }
    }
}

// Start conditional UI when page loads
startConditionalUI();

const errorText = document.getElementById("error-text");

// Track error text height to keep CSS variable in sync
const resizeObserver = new ResizeObserver(entries => {
    document.documentElement.style.setProperty('--error-text-height', errorText.scrollHeight + 'px');
});
resizeObserver.observe(document.documentElement);
document.documentElement.style.setProperty('--error-text-height', errorText.scrollHeight + 'px');

// Display an error message and expand the error banner
function showError(message) {
    errorText.innerHTML = message;
    document.documentElement.style.setProperty('--error-text-height', errorText.scrollHeight + 'px');
    document.body.classList.add("show-error");
}

const loginButton = document.getElementById("login-button");
const usernameInput = document.getElementById("username-input");

loginButton.addEventListener("click", async () => {
    const username = usernameInput.value.trim().toLowerCase();
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
