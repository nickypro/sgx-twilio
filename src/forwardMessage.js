const twilio = require( 'twilio' )
const config = require( './config' )
const { genKeys, newMessage } = require( './helper' )

// handler for api server: forward incoming sms from twilio to xmpp
async function forwardSmsToXmpp( xmpp, body, res ) {
    const text = body.Body
    const fromNumber = body.From
    const toNumber = body.To
    const accountSid = body.AccountSid
    const from = fromNumber + "@" + config.COMPONENT_DOMAIN
    const to = await redis.getAsync( fromNumber ) || config.XMPP_ADMIN
    const keys = genKeys( to )
    const expectedAccountSid = await redis.getAsync( keys.userAccountSid )
    
    if ( expectedAccountSid != accountSid ) {
        await xmpp.send( newMessage( `Unexpected message to ${ toNumber }`, to ) )
        return
    }

    await xmpp.send( newMessage( text, to, from ) )
    res.end()
}

// when the stanza message is to a phone number
async function forwardXmppToSms( xmpp, redis, origin ) {
    const msg = ( text ) => newMessage( text, origin.from, origin.to )
    const keys = genKeys( origin.from )

    const ACCOUNT_SID = await redis.getAsync( keys.userAccountSid )
    const ACCOUNT_AUTH_TOKEN = await redis.getAsync( keys.userAuthToken )
    const fromNumber = await redis.getAsync( keys.userNumber )
    const toNumber = origin.to.split('@')[0]

    twilioClient = twilio( ACCOUNT_SID, ACCOUNT_AUTH_TOKEN )
    twilioClient.messages
      .create({
               body: origin.text,
               from: fromNumber, 
               to: toNumber
             })
      .then(message => console.log(message.sid));
}

module.exports = {
    forwardXmppToSms,
    forwardSmsToXmpp,
}
