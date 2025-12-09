// Only logs in development mode
const isDev = process.env.NODE_ENV !== 'production';

const logger = {
    log: isDev ? console.log.bind(console) : () => { },
    info: isDev ? console.info.bind(console) : () => { },
    warn: console.warn.bind(console), // Always log warnings
    error: console.error.bind(console), // Always log errors
    debug: isDev ? console.debug.bind(console) : () => { },
};

module.exports = logger;

