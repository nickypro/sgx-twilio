const config = require( './config' )
const { forwardXmppToSms } = require( './forwardMessage' )
const { getUserState, newMessage } = require( './helper' )
const { testUserCredentials, setPhoneSid, setupPhoneUrl } = require( './twilioFunctions' )

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
    const user = getUserState( redis, origin.from )
    const text = origin.text.trim()

    const helpString = `Commands:
    register : Set up twilio account and number using API key
    register auth : Set up twilio account and number using Auth Token
    cancel   : Return to this help text
    number   : Show phone number
    status   : Show user config status
    clear    : Clear your user config`

    const simpleCommands = new Set([ "status", "help", "cancel", "clear", "number" ])
    const flowCommands = new Set([ "register", "register auth" ])

    const authTokenRegistrationVars = [
        { name: "accountSid", label: "Enter Twilio Account SID" },
        { name: "authToken", label: "Enter Twilio Auth Token" },
        { name: "phoneNumber", label: "Enter Twilio Phone Number you would like to use" +
            ", in E.164 Format ( ie: with a + )" },
    ]
    const apiKeyRegistrationVars = [
        { name: "accountSid", label: "Enter Twilio Account SID" },
        { name: "apiKeySid", label: "Enter Twilio Api Key SID" },
        { name: "apiKeySecret", label: "Enter Twilio Api Key Secret" },
        { name: "phoneNumber", label: "Enter Twilio Phone Number you would like to use" +
            ", in E.164 Format ( ie: with a + )" },
    ]

    const showHelp = async () => {
        await xmpp.send( msg( helpString ) )
    }

    const showNumber = async () => {
        const phoneNumber = await user.phoneNumber.get() || "no number set up"
        await xmpp.send( msg( phoneNumber ) )
    }

    const showStatus = async () => {
        const userData = await user.getAll()
        await xmpp.send( msg( `Status: ${ JSON.stringify( userData, null, 2 ) }}`) )
        await user.botStatus.set( "help" )
    }

    const runClear = async () => {
        const phoneNumber = await user.phoneNumber.get()
        if ( typeof(phoneNumber) == "string" ) {
            const oldJid = await redis.getAsync( phoneNumber )
            if ( oldJid == user.jid ) {
                console.log("removing phone number ", phoneNumber, " from ", user.jid)
                await redis.delAsync( phoneNumber )
            }
        } 
        await user.clearAll()
        await xmpp.send( msg( "User state cleared" ) )
    }


    const initialStatus = await user.botStatus.get()
    let currentStatus = initialStatus
    const cmd = text.toLowerCase()

    // eg: handleInputFlow( "register_", [{name: "accountSid", label: "Enter SID"}] ) {}
    const handleInputFlow = async ( prefix, vars ) => {
        const re = new RegExp( "^" + prefix )
        if ( !re.test( currentStatus ) ) return false

        const statuses = vars.map( x => prefix + x.name )
        if ( initialStatus == currentStatus ) {
            const i = statuses.indexOf( currentStatus )
            if ( i < 0 ) return false

            await user[ vars[i].name ].set( text )
            if ( i == vars.length - 1 ) {
                console.log( "Registration Completed" )
                return true
            }
            currentStatus = statuses[ i + 1 ]
        }

        const i = statuses.indexOf( currentStatus )
        if ( i < 0 ) return false
        await xmpp.send( msg( vars[i].label ) )
        return false
    }

    const completeRegistration = async () => {
        try {
            const errMsg = await testUserCredentials( user )
            if ( errMsg ) throw errMsg
            const number = await user.phoneNumber.get()
            const jid = await redis.getAsync( number )
            if ( jid && jid != user.jid )
                throw new Error( `Number already in use by ${jid}` )
            await redis.setAsync( number, origin.from )
            await setPhoneSid( user )
            setupPhoneUrl( user )
            await xmpp.send( msg( "Signup Successful" ) )

        } catch ( err ) {
            await xmpp.send( msg( "Error signing up: " + err ) )
            await user.clearAll()
        }
        currentStatus = "help"
        return
    }

    if ( ! currentStatus ) {
        await user.botStatus.set( "help" )
        currentStatus = "help"
    }

    // Simple commands
    if ( simpleCommands.has( cmd ) ){
        switch ( cmd ) {
            case "clear":
                await runClear()
                break
            case "status":
                showStatus()
                break
            case "number":
                showNumber()
                break
            case "help":
            case "cancel":
                showHelp()
                break;
        }
        await user.botStatus.set( "help" )
        return

    } else {
        // Begin Command Flow
        if ( flowCommands.has( cmd ) ) {
            switch ( cmd ) {
                case "register auth":
                    currentStatus = "register_authToken_accountSid"
                    break;
                case "register":
                    currentStatus = "register_apiKey_accountSid"
                    break;
            }
        }

        let end = false
        end = await handleInputFlow( "register_apiKey_", apiKeyRegistrationVars )
        if ( end ) {
            console.log( "End of API Key Flow:", end )
            completeRegistration()
            return
        }
        
        end = await handleInputFlow( "register_authToken_", authTokenRegistrationVars )
        if ( end ) {
            console.log( "End of Auth Token Flow:", end )
            completeRegistration()
            return
        }

    }

    await user.botStatus.set( currentStatus )

}

module.exports = handleIncomingMessage
