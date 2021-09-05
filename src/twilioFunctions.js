const config = require( './config' )
const twilio = require( 'twilio' );

async function sendSms( user, to, text ) {
    const { accountSid, authToken, fromNumber } = await user.getAll()
    twilioClient = twilio( accountSid, authToken )
    twilioClient.messages
        .create({
            body: text,
            from: fromNumber, 
            to,
        })
        .then(message => console.log(' Sent Message: ', message.sid));
}

function setPhoneSid( user ) {
    return new Promise( ( resolve, reject ) => {
        user.getAll().then( ({ accountSid, authToken, phoneNumber }) => {
            const twilioClient = twilio( accountSid, authToken )
            twilioClient.incomingPhoneNumbers
                .list({ phoneNumber, limit: 20 })
                .then( async ( phones ) => { 
                    await user.phoneSid.set( phones[ 0 ].sid ) 
                    console.log( "set phoneSid to", phones[ 0 ].sid )
                    resolve( 0 )
                })
        }).catch( err => reject( err ) )
    })
}

async function setupPhoneUrl( user ) {
    if ( !config.API_HOST ) {
        console.log( "No reviece URI set up, set 'API_HOST' variable" )
        return
    }

    const [ accountSid, authToken, phoneSid ] = await user.get(
        [ 'accountSid', 'authToken', 'phoneSid' ]
    )
    const twilioClient = twilio( accountSid, authToken )
    await twilioClient.incomingPhoneNumbers( phoneSid )
            .update({ smsUrl: config.TWILIO_RECIEVE_URL })
            .then( res => console.log( `Set up recieve URL for ${ res.phoneNumber }` ) )
}

function testUserCredentials( user ) {
    return new Promise( async ( resolve ) => {
        user.getAll().then( ({ accountSid, authToken, phoneNumber }) => {

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
    setupPhoneUrl,
    testUserCredentials,
}
