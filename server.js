const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const qs = require('qs')
const axios = require('axios');
const twilio = require('twilio');
const { component, xml, jid } = require("@xmpp/component");
const { promisifyAll } = require('bluebird');

const XMPP_ADMIN = process.env.XMPP_ADMIN
const COMPONENT_HOST = process.env.COMPONENT_HOST || "xmpp://prosody:5347"
const COMPONENT_DOMAIN = process.env.COMPONENT_DOMAIN
const COMPONENT_SECRET = process.env.COMPONENT_SECRET
const REDIS_HOST = process.env.REDIS_HOST || "sgx-redis"
const REDIS_PORT = process.env.REDIS_PORT || 6379
const API_PORT = process.env.PORT || 80

newMessage = ( text, to, from=COMPONENT_DOMAIN ) => {
    const message = xml(
        "message",
        { type: "chat", from, to },
        xml("body", {}, text),
    );
    return message;
};

// init Redis connection
const redisLib = require('redis');
promisifyAll(redisLib);
console.log("Connecting to Redis")
const redis = redisLib.createClient({
    host: REDIS_HOST,
    port: REDIS_PORT,
});

// Redis store of user keys data
const genKeys = ( from ) => ({
        userBotStatus:  from + "::userBotStatusKey",
        userAccountSid: from + "::userAccountSid",
        userAuthToken: from + "::userAuthToken",
        userNumber: from + "::userPhoneNumber",
})

// handler for api server: forward incoming sms from twilio to xmpp
async function forwardSmsToXmpp( xmpp, body, res ) {
    const text = body.Body
    const fromNumber = body.From
    const toNumber = body.To
    const accountSid = body.AccountSid
    const from = fromNumber + "@" + COMPONENT_DOMAIN
    const to = await redis.getAsync( fromNumber ) || XMPP_ADMIN
    const keys = genKeys( to )
    const expectedAccountSid = await redis.getAsync( keys.userAccountSid )
    
    if ( expectedAccountSid != accountSid ) {
        await xmpp.send( newMessage( `Unexpected message to ${ toNumber }`, to ) )
        return
    }

    await xmpp.send( newMessage( text, to, from ) )
    res.end()
}

// init http server connection 
const startApiServer = ( xmpp ) => {
    const app = express();
    app.use(bodyParser.urlencoded({ extended: false }));

    app.post('/sms', (req, res) => {
        console.log( "POST /sms", req )
        console.log( "POST:", req.body )
        forwardSmsToXmpp( xmpp, req.body, res )
    });

    app.get('/', (req, res) => {
        console.log( "GET" )
        res.sendStatus('404')
    })

    http.createServer( app ).listen( API_PORT, () => {
      console.log('Twilio Bridge Server started on port ', API_PORT );
    });
}


const handleBot = async ( xmpp, redis, origin ) => {
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

const forwardXmppToSms = async ( xmpp, redis, origin ) => {
    const msg = ( text ) => newMessage( text, origin.from, origin.to )
    const keys = genKeys( origin.from )

    // get base64 auth token
    const ACCOUNT_SID = await redis.getAsync( keys.userAccountSid )
    const ACCOUNT_AUTH_TOKEN = await redis.getAsync( keys.userAuthToken )
    const fromNumber = await redis.getAsync( keys.userNumber )
    const toNumber = origin.to.split('@')[0]
    const str = `${ACCOUNT_SID}:${ACCOUNT_AUTH_TOKEN}`
    const buff = Buffer.from(str, 'utf-8');
    const base64 = buff.toString('base64');

    twilioClient = twilio( ACCOUNT_SID, ACCOUNT_AUTH_TOKEN )
    twilioClient.messages
      .create({
               body: origin.text,
               from: fromNumber, 
               to: toNumber
             })
      .then(message => console.log(message.sid));

/*
    axios({
        method: 'post',
        url: `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
        headers: { 
            'Authorization': `Basic ${base64}`,
        },
        data: qs.stringify({
            To: "+353862238618",
            From: NUMBER,
            Body: origin.text,
        })
    }).catch( console.error ).then( res => console.log( res.data.status ) )
    */

}

// init XMPP connection
const startSgx = () => {
    const xmpp = component({
        service: COMPONENT_HOST,
        domain: COMPONENT_DOMAIN,
        password: COMPONENT_SECRET,
    });

    xmpp.on( "error", console.error )

    xmpp.on("offline", () => {
        console.log("offline");
        
    });

    xmpp.on("disconnect", (err) => {
        console.log( err )
    })

    xmpp.on("stanza", async (stanza) => {
        if (!stanza.is("message")) return;

        const origin = {
            from: stanza.attrs.from.split("/")[0],
            to: stanza.attrs.to
        }
        const body = stanza.getChild( 'body' )
        if ( body ) {
            origin.text = body.text()
            console.log( `FROM ${origin.from} TO ${origin.to}: ${origin.text}` )
        
            if ( origin.to == COMPONENT_DOMAIN ) {
                handleBot( xmpp, redis, origin )
            } else if ( /^\+\d+$/.test( origin.to.split("@")[0] ) ) {
                forwardXmppToSms( xmpp, redis, origin )
            }
        }
    });

    xmpp.on("online", async (address) => {
        console.log("online as", address.toString());
        const message = newMessage( "Now Online Again", "nicky@nicky.pro" )
        await xmpp.send( message );
        startApiServer( xmpp )
    })
    
    console.log( "Connecting to XMPP" )
    xmpp.start().catch( err => console.error( err ) )
}

startSgx()
