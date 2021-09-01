const config = require( './src/config' )
const handleIncomingMessage = require( './src/handleIncomingMessage' )
const handleIncomingIq = require( './src/handleIncomingIq' )
const redisLib = require('redis');
const startApiServer = require( './src/startApiServer' )
const { component } = require("@xmpp/component");
const { newMessage } = require( './src/helper' )
const { promisifyAll } = require('bluebird');
promisifyAll( redisLib );

// init Redis connection
console.log( "Connecting to Redis" )
const redis = redisLib.createClient({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD
});


// init XMPP connection
const startSgx = () => {
    const xmpp = component({
        service: config.COMPONENT_HOST,
        domain: config.COMPONENT_DOMAIN,
        password: config.COMPONENT_SECRET,
    });

    xmpp.on( "error", console.error )

    xmpp.on( "offline", () => {
        console.log( "offline" );
        
    });

    xmpp.on( "disconnect", ( err ) => {
        console.log( err )
    })

    xmpp.on( "stanza", async ( stanza ) => {
        console.log( stanza )
        if ( stanza.is( "message" ) ) {
            handleIncomingMessage( xmpp, redis, stanza );
        } else if ( stanza.is( "iq" ) ) {
            handleIncomingIq( xmpp, redis, stanza )
        }
    });

    xmpp.on( "online", async (address) => {
        console.log( "online as", address.toString() );
        if ( config.XMPP_ADMIN ) {
            const message = newMessage( "Now Online Again", config.XMPP_ADMIN )
            await xmpp.send( message );
        }
        startApiServer( xmpp )
    })
    
    console.log( "Connecting to XMPP" )
    xmpp.start().catch( err => console.error( err ) )
}

startSgx()
