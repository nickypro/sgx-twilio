const config = require( './config' )
const { xml } = require("@xmpp/component");

// Redis store of user keys data
function genKeys( from ) {
    return {
        userBotStatus:  from + "::userBotStatusKey",
        userAccountSid: from + "::userAccountSid",
        userAuthToken: from + "::userAuthToken",
        userNumber: from + "::userPhoneNumber",
    }
}

function newMessage( text, to, from=config.COMPONENT_DOMAIN ) {
    const message = xml(
        "message",
        { type: "chat", from, to },
        xml("body", {}, text),
    );
    return message;
};

module.exports = {
    genKeys,
    newMessage,
}
