const config = require( './config' )
const twilio = require( 'twilio' )
const { xml } = require("@xmpp/component");

// Redis store of user keys data
function getUserState( redis, rawJid ) {
    const jid = rawJid.split('/')[ 0 ]
    const finalMap = {
        jid,
    }
    const keyNames = {
        botStatus:  jid + "::userBotStatusKey",
        accountSid: jid + "::userAccountSid",
        authToken: jid + "::userAuthToken",
        phoneNumber: jid + "::userPhoneNumber",
        phoneSid: jid + "::userPhoneSid",
    }
    Object.keys( keyNames ).forEach( keyName => {
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
            "del": () => new Promise( resolve => {
                redis.del( key, ( err, reply ) => {
                    if ( err ) throw err;
                    resolve( reply )
                })
            }),
        }
    })
    // eg: user.get( [ 'accountSid', 'authToken', 'phoneNumber' ] )
    finalMap.get = ( arr ) => Promise.all( 
        ( () => arr.map( keyName => finalMap[ keyName ].get() ) )()
    )

    // eg: user.getAll().then( ({ accountSid, authToken }) => ... )
    finalMap.getAll = () => new Promise( resolve => {
        const keys = Object.keys( keyNames )
        Promise.all( 
            ( () => keys.map( keyName => finalMap[ keyName ].get() ) )() 
        ).then( valsArr => {
            console.log( valsArr )
            const valsObj = {}
            keys.forEach( ( keyName, i ) => valsObj[ keyName ] = valsArr[ i ] )
            console.log( valsObj )
            resolve( valsObj )
        })
    })

    // eg: user.set( [ 'accountSid', 'authToken' ], [ val1, val2 ] )
    finalMap.set = ( obj ) => Promise.all(
        ( () => Object.keys( obj ).map( keyName => {
                return finalMap[ keyName ].set( obj[ keyName ] )
            }) )()
    )

    // eg: user.clear( [ 'accountSid', 'authToken', 'phoneNumber' ] )
    finalMap.clear = ( arr ) => Promise.all(
        ( () => arr.map( keyName => finalMap[ keyName ].del() ) )()
    )
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
