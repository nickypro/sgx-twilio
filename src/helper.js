const config = require( './config' )
const { xml } = require("@xmpp/component");

// Redis store of user keys data
function getUserState( redis, jid ) {
    const finalMap = {}
    const keyNames = {
        botStatus:  jid + "::userBotStatusKey",
        accountSid: jid + "::userAccountSid",
        authToken: jid + "::userAuthToken",
        phoneNumber: jid + "::userPhoneNumber",
    }
    Object.keys( keyNames ).map( keyName => {
        const key = keyNames[ keyName ]
        finalMap[ keyName ] = {
            "key": key,
            "get": () => new Promise( resolve => { 
                redis.get( key, ( err, reply ) => {
                    if ( err ) throw err;
                    resolve( reply )
                })
            }),
            "set": ( value ) => new Promise( resolve => {
                redis.set( key, value, ( err, reply ) => {
                    if ( err ) throw err;
                    resolve( reply )
                })
            }),
        }
    })
    console.log( finalMap )
    return finalMap
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
    getUserState,
    newMessage,
}
