const express = require('express');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const prisma = require('../lib/prisma');
const { rpID, origin } = require('../lib/config');
const { randomId, base64URLStringToBuffer, bufferToBase64URLString } = require('../lib/utils');

const router = express.Router();

// In Memory Storage for challenges
const temporaryUsers = new Map();
const loginChallenges = new Map();

// Signup request - generate registration options
router.post("/signup-request/", async (req, res) => {
    const { username } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
        return res.status(400).json({ error: "Username unavailable" });
    }

    const tempUser = { id: randomId(), username, credentials: [] };
    temporaryUsers.set(tempUser.id, tempUser);

    const options = await generateRegistrationOptions({
        rpName: "Networked Media Final",
        rpID,
        userID: new TextEncoder().encode(tempUser.id),
        userName: username,
        timeout: 60000,
        attestationType: "none",
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });

    tempUser.currentChallenge = options.challenge;
    res.json({ options: options });
});

// Signup response - verify registration
router.post("/signup-response/", async (req, res) => {
    const { userId, attestationResponse } = req.body;
    const originalUserId = new TextDecoder().decode(base64URLStringToBuffer(userId));
    const user = temporaryUsers.get(originalUserId);
    if (!user) {
        return res.status(400).json({ error: "Temporary user not found" });
    }

    try {
        const verification = await verifyRegistrationResponse({
            response: attestationResponse,
            expectedChallenge: user.currentChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });

        if (verification.verified) {
            const dbUser = await prisma.user.create({
                data: {
                    username: user.username,
                    isAdmin: false,
                },
            });

            const cred = verification.registrationInfo.credential;
            await prisma.credential.create({
                data: {
                    userId: dbUser.id,
                    credentialId: cred.id,
                    publicKey: bufferToBase64URLString(Buffer.from(cred.publicKey)),
                    counter: cred.counter,
                    transports: JSON.stringify(cred.transports),
                },
            });

            temporaryUsers.delete(originalUserId);

            req.session.userId = dbUser.id;
            req.session.username = dbUser.username;
        }

        res.json({ ok: verification.verified });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

// Login request - generate authentication options
router.post("/login-request/", async (req, res) => {
    const { username } = req.body;
    const user = await prisma.user.findUnique({
        where: { username },
        include: { credentials: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const options = await generateAuthenticationOptions({
        timeout: 60000,
        rpID,
        allowCredentials: user.credentials.map(c => ({
            id: c.credentialId,
            type: "public-key",
        })),
        userVerification: "preferred",
    });

    loginChallenges.set(user.id, options.challenge);
    res.json({ options: options, userId: user.id });
});

// Login response - verify authentication
router.post("/login-response/", async (req, res) => {
    const { userId, authenticationResponse } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const expectedChallenge = loginChallenges.get(userId);
    if (!expectedChallenge) return res.status(400).json({ error: "No login challenge found" });

    const cred = await prisma.credential.findUnique({ where: { credentialId: authenticationResponse.id } });
    if (!cred) return res.status(404).json({ error: "Credential not found" });

    try {
        const verification = await verifyAuthenticationResponse({
            response: authenticationResponse,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: base64URLStringToBuffer(cred.credentialId),
                publicKey: base64URLStringToBuffer(cred.publicKey),
                counter: cred.counter,
                transports: cred.transports ? JSON.parse(cred.transports) : [],
            },
        });

        if (verification.verified) {
            await prisma.credential.update({
                where: { id: cred.id },
                data: { counter: verification.authenticationInfo.newCounter },
            });
            loginChallenges.delete(userId);

            req.session.userId = user.id;
            req.session.username = user.username;

            res.json({ ok: true });
        } else {
            res.json({ ok: false });
        }
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

// Logout
router.get('/logout/', async (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;

