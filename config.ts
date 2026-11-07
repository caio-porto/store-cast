export const CONFIG = {
    // Environment toggles
    IS_PRODUCTION: true, // Set to true to connect to the production backend
    FORCE_SCREEN_MODE: false, // Set to true to force the app to render as a TV Screen

    // Production Endpoints (replace with your own domains when deploying)
    PRODUCTION: {
        DOMAIN_SCREEN: 'tv.yourdomain.com',
        DOMAIN_ADMIN: 'admin.yourdomain.com',
    },

    // Local Test Endpoints
    LOCAL: {
        DEFAULT_SCREEN_PORT: 8765,
        DEFAULT_ADMIN_PORT: 8766,
    }
};
