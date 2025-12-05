module.exports = {
    apps: [
        {
            name: "orchard_of_letters",
            script: "./server.js",
            env: {
                PORT: 3004,
                NODE_ENV: "development"
            },
            env_production: {
                PORT: 3004,
                NODE_ENV: "production"
            }
        }
    ]
};