const bodyParser = require( 'body-parser' );
const config = require( './config' )
const express = require( 'express' );
const http = require( 'http' );
const { forwardSmsToXmpp } = require( './forwardMessage' )

// init http server connection 
async function startApiServer( xmpp ) {
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

    http.createServer( app ).listen( config.API_PORT, () => {
      console.log('Twilio Bridge Server started on port ', config.API_PORT );
    });
}

module.exports = startApiServer
