const config = require( './config' )
const { forwardXmppToSms } = require( './forwardMessage' )
const { genKeys, newMessage } = require( './helper' )

// Code for handling when a user sends a <message> stanza to the server
async function handleIncomingMessage( xmpp, redis, stanza ) {
    const origin = {
        from: stanza.attrs.from.split("/")[0],
        to: stanza.attrs.to,
    }
    const body = stanza.getChild( 'body' )
    if ( body ) {
        origin.text = body.text()
        console.log( `FROM ${origin.from} TO ${origin.to}: ${origin.text}` )
    
        if ( origin.to == config.COMPONENT_DOMAIN ) {
            handleBot( xmpp, redis, origin )
        } else if ( /^\+\d+$/.test( origin.to.split("@")[0] ) ) {
            forwardXmppToSms( xmpp, redis, origin )
        }
    }
}

// when the stanza message is to the bot
async function handleBot( xmpp, redis, origin ) {
    const msg = ( text ) => newMessage( text, origin.from, origin.to )
    const keys = genKeys( origin.from )

    const helpString = `Commands:
    register : Register twilio account and number
    cancel   : ( any time ) return to this help text
    status   : Show status`

    let userStatus = await redis.getAsync( keys.userBotStatus )
    let finalStatus = userStatus
    if ( ! userStatus || origin.text.toLowerCase().trim() == "cancel" ) {
        await redis.setAsync( keys.userBotStatus, "help" )
        userStatus = "help"
    }
    switch ( userStatus ) {
        case "register_account_sid":
            await redis.setAsync( keys.userAccountSid, origin.text )
            finalStatus = "register_auth_token"
            break;
        case "register_auth_token":
            await redis.setAsync( keys.userAuthToken, origin.text )
            finalStatus = "register_number"
            break;
        case "register_number":
            const number = origin.text.trim()
            if ( ! /^\+\d+$/.test( number ) ) {
                await xmpp.send( msg( "Invalid Phone Number" ) )
                return
            }
            await redis.setAsync( keys.userNumber, number )
            await redis.setAsync( number, origin.from )
            finalStatus = "register_end"
            break;
        case "help":
            switch ( origin.text.toLowerCase().trim() ) {
                case "register":
                    finalStatus = "register_account_sid"
                    break;
                case "status":
                    finalStatus = "status"
                    break;
                default:
                    finalStatus = "help"
                    break; 
            }
            break
        default:
            await xmpp.send( msg( `unknown status: '${userStatus}'` ) )
    }
    
    await redis.setAsync( keys.userBotStatus, finalStatus )
   
    if ( userStatus != "help" && userStatus == finalStatus ) {
        await xmpp.send( msg( "Try Again" ) )
        return
    }

    switch ( finalStatus ) {
        case "help":
            await xmpp.send( msg( helpString ) )
            break;
        case "register_account_sid":
            await xmpp.send( msg( "Enter Account SID" ) )
            break;
        case "register_auth_token":
            await xmpp.send( msg( "Enter Auth Token" ) )
            break;
        case "register_number":
            await xmpp.send( msg( "Enter Phone Number ( in E.164 format: + country_code phone_number )" ) )
            break;
        case "register_end":
            await xmpp.send( msg( "Successfully Registered" ) )
        case "status":
            userAccountSid = await redis.getAsync( keys.userAccountSid )
            userAuthToken = await redis.getAsync( keys.userAuthToken )
            userNumber = await redis.getAsync( keys.userNumber )
            await xmpp.send( msg( `Status: ${userAccountSid}, ${userAuthToken}, ${userNumber}`) )
            await redis.setAsync( keys.userBotStatus, "help" )
            break
    }

}

module.exports = handleIncomingMessage
