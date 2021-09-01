module.exports = {
    XMPP_ADMIN: process.env.XMPP_ADMIN,
    COMPONENT_HOST: process.env.COMPONENT_HOST || "xmpp://prosody:5347",
    COMPONENT_DOMAIN: process.env.COMPONENT_DOMAIN,
    COMPONENT_SECRET: process.env.COMPONENT_SECRET,
    REDIS_HOST: process.env.REDIS_HOST || "redis-twilio",
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    API_PORT: process.env.PORT || 80,
}
