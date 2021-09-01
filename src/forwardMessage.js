const twilio = require( 'twilio' )
const config = require( './config' )
const { getUserState, newMessage } = require( './helper' )

// handler for api server: forward incoming sms from twilio to xmpp
async function forwardSmsToXmpp( xmpp, body, res ) {
    const text = body.Body
    const fromNumber = body.From
    const toNumber = body.To
    const accountSid = body.AccountSid
    const from = fromNumber + "@" + config.COMPONENT_DOMAIN
    const to = await redis.getAsync( fromNumber ) || config.XMPP_ADMIN
    const user = getUserState( to )
    const expectedAccountSid = await user.accountSid.get()
    
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
    const user = getUserState( redis, origin.from )

    const accountSid = await user.accountSid.get()
    const authToken = await user.authToken.get()
    const fromNumber = await user.phoneNumber.get()
    const toNumber = origin.to.split('@')[0]

    twilioClient = twilio( accountSid, authToken )
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
