const config = require( './config' )
const twilio = require( 'twilio' )
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
    finalMap.get = ( arr ) => new Promise.all( 
        ( arr.map( keyName => finalMap[ keyName ].get() ) )()
    )

    // eg: user.clear( [ 'accountSid', 'authToken', 'phoneNumber' ] )
    finalMap.clear = ( arr ) => new Promise.all(
        ( arr.map( keyName => finalMap[ keyName ].del() ) )()
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

function testUserCredentials( user ) {
    return new Promise( async ( resolve, reject ) => {
        Promise.all([ user.accountSid.get(), user.authToken.get(), user.phoneNumber.get() ])
            .then( ([ accountSid, authToken, phoneNumber ]) => {
                console.log( "verifying:", accountSid, authToken, phoneNumber )
                twilio( accountSid, authToken ).incomingPhoneNumbers
                    .list( { limit: 20, phoneNumber } )
                    .then( incomingPhoneNumbers => {
                        if ( incomingPhoneNumbers.length == 0 )
                            throw new Error( "Number not found" )
                        if ( incomingPhoneNumbers.length > 1 )
                            throw new Error( "Number not specific enough" )
                        if ( incomingPhoneNumbers[0].phoneNumber != phoneNumber )
                            throw new Error( "Number error" )
                        resolve( 0 )
                     }) 

            }).catch( err => reject( err ) )
    })
}

module.exports = {
    getUserState,
    newMessage,
    testUserCredentials,
}
