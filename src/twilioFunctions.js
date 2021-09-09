const config = require( './config' )
const twilio = require( 'twilio' );

function getTwilioClient({ accountSid, authToken, apiKeySid, apiKeySecret }) {
    if ( ! /^AC/.test( accountSid ) ) {
        throw new Error( "Account SID must start with AC" )
    }
    if ( authToken ) {
        return twilio( accountSid, authToken )
    } else if ( apiKeySid && apiKeySecret) {
        return twilio( apiKeySid, apiKeySecret, { accountSid } )
    }

    throw new Error( " must have either authToken or both an apiKeySid and apiKeySecret" )
}

async function sendSms( user, to, text ) {
    const userData = await user.getAll()
    twilioClient = getTwilioClient( userData )
    twilioClient.messages
        .create({
            body: text,
            from: userData.phoneNumber,
            to,
        })
        .then(message => console.log(' Sent Message: ', message.sid));
}

function setPhoneSid( user ) {
    return new Promise( ( resolve, reject ) => {
        user.getAll().then( userData => {
            const twilioClient = getTwilioClient( userData )
            twilioClient.incomingPhoneNumbers
                .list({ phoneNumber: userData.phoneNumber, limit: 20 })
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
        console.error( "No reviece URI set up, set 'API_HOST' variable" )
        return
    }

    const userData = await user.getAll()
    const twilioClient = getTwilioClient( userData )
    await twilioClient.incomingPhoneNumbers( userData.phoneSid )
            .update({ smsUrl: config.TWILIO_RECIEVE_URL })
            .then( res => console.log( `Set up recieve URL for ${ res.phoneNumber }` ) )
}

function testUserCredentials( user ) {
    return new Promise( async ( resolve ) => {
        user.getAll().then( ( userData ) => {

            console.log( "verifying:", userData )
            const phoneNumber = userData.phoneNumber
            const twilioClient = getTwilioClient( userData )
            twilioClient.incomingPhoneNumbers
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
