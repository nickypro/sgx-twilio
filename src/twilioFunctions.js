const twilio = require( 'twilio' );

async function sendSms( user, to, text ) {
    const [ accountSid, authToken, fromNumber ] = await user.get(
        [ 'accountSid', 'authToken', 'phoneNumber' ]
    )
    twilioClient = twilio( accountSid, authToken )
    twilioClient.messages
        .create({
            body: text,
            from: fromNumber, 
            to,
        })
        .then(message => console.log(' Sent Message: ', message.sid));
}

async function setPhoneSid( user ) {
    const [ accountSid, authToken, phoneNumber ] = await user.get(
        [ 'accountSid', 'authToken', 'phoneNumber' ]
    )
    const twilioClient = twilio( accountSid, authToken )
    const phone = await twilioClient.incomingPhoneNumbers.list({ phoneNumber })
    
    await user.phoneSid.set( phone.sid )
}

function testUserCredentials( user ) {
    return new Promise( async ( resolve ) => {
        Promise.all([ user.accountSid.get(), user.authToken.get(), user.phoneNumber.get() ])
            .then( ([ accountSid, authToken, phoneNumber ]) => {

                console.log( "verifying:", accountSid, authToken, phoneNumber )
                if ( ! /^AC/.test( accountSid ) ) {
                    resolve( new Error( "Account SID must start with AC" ) )
                    return
                }
                console.log( "asking twilio" )
                twilio( accountSid, authToken ).incomingPhoneNumbers
                    .list( { limit: 20, phoneNumber }, ( error, message ) => {
                        if ( error ) {
                            resolve( error )
                            return
                        }

                        const incomingPhoneNumbers = message
                        console.log( 'Twilio number:', incomingPhoneNumbers )

                        if ( incomingPhoneNumbers.length == 0 ) {
                            resolve( new Error( "Number not found" ) )
                            return
                        }
                        if ( incomingPhoneNumbers.length > 1 ) {
                            resolve( new Error( "Number not specific enough" ) )
                            return
                        }
                        if ( incomingPhoneNumbers[0].phoneNumber != phoneNumber ) {
                            resolve( new Error( "Number error" ) )
                            return
                        }
                        resolve( 0 )
                     })

            }).catch( err => {
                console.log( `Error verifying ${ user.jid }: `, err.message)
                resolve( err )
            })
    })
}

module.exports = {
    sendSms,
    setPhoneSid,
    testUserCredentials,
}
