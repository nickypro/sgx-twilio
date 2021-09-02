module.exports = {
    XMPP_ADMIN: process.env.XMPP_ADMIN,
    COMPONENT_HOST: process.env.COMPONENT_HOST || "xmpp://prosody:5347",
    COMPONENT_DOMAIN: process.env.COMPONENT_DOMAIN,
    COMPONENT_SECRET: process.env.COMPONENT_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    API_PORT: process.env.PORT || 80,
    API_HOST: process.env.API_HOST || "",
    TWILIO_RECIEVE_URL: process.env.API_HOST + "/sms",
}
