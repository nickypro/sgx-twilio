const config = require( './config' )
const { getUserState, newMessage } = require( './helper' )
const { sendSms } = require( './twilioFunctions' )

// handler for api server: forward incoming sms from twilio to xmpp
async function forwardSmsToXmpp( xmpp, redis, body, res ) {
    const text = body.Body
    const fromNumber = body.From
    const toNumber = body.To
    const accountSid = body.AccountSid
    const from = fromNumber + "@" + config.COMPONENT_DOMAIN
    const to = await redis.getAsync( toNumber ) || config.XMPP_ADMIN
    const user = getUserState( redis, to )
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
    const user = getUserState( redis, origin.from )
    const toNumber = origin.to.split( '@' )[ 0 ]
    const text = origin.text

    sendSms( user, toNumber, text )
}

module.exports = {
    forwardXmppToSms,
    forwardSmsToXmpp,
}
