const { genKeys, newMessage } = require( './helper' )

// Code for handling when a user sends a <message> stanza to the server
async function handleIncomingIq( xmpp, redis, stanza ) {
    const origin = {
        from: stanza.attrs.from.split("/")[0],
        to: stanza.attrs.to,
        type: stanza.attrs.type,
        query: stanze.getChild('query'),
    }
    const keys = genKeys( origin.from )

    if ( !query ) {
        await xmpp.send( newMessage( "Invalid iq request: no query", origin.to ) )
        return
    }
    
    const xmlns = query.attrs.xmlns
    if ( query.attrs.xmlns != "jabber:iq:register" ) {
        await xmpp.send( newMessage( `Invalid query: ${xmlns} is not supported.` +
                         `Only xmlns=jabber:iq:reqister is supported`, origin.to ) )
        return
    }
    
    if ( origin.type == "get" ) {
        const instructions = 'Please enter ' + 
            ' your Twilio Account SID ( username ),' + 
            ' Twilio Auth Token ( password ), and the Phone number ( number ) ' +
            ' ( in E.164 format ) you would like to use with this account'
        const registrationForm = xml(
            'iq',
            {to: origin.from, from: origin.to, type: 'result'},
            xml(
                'query',
                { xmlns: 'jabber:iq:register' },
                xml( 'instructions', {}, instructions ),
                xml( 'username', {} ),
                xml( 'password', {} ),
                xml( 'number', {} )
            )
        )
        await xmpp.send( registrationForm )
    }
    
    if ( origin.type == "set" ) {
        const username = query.getChild( 'username' )
        const password = query.getChild( 'password' )
        const number   = query.getChild( 'number' )

        if ( !username || !password || !number || !/^\+\d+$/.text( number.text() ) ) {
            const errorStanza = xml(
                'iq',
                {to: origin.from, from: origin.to, type: 'error'},
                xml('query',
                    { xmlns: 'jabber:iq:register' },
                    xml( 'username', {}, username ),
                    xml( 'password', {}, password ),
                    xml( 'number', {}, number )
                ),
                xml('error', 
                    { code: '406', type: 'modify'},
                    xml('not-acceptable', 
                        { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' } 
                    )
                )
            )
            await xmpp.send( errorStanza )
            return
        }

        const currentNumberOwner = await redis.getAsync( number.text() )
        if ( currentNumberOwner ) {
            const errorStanza = xml('iq',
                {to: origin.from, from: origin.to, type: 'error'},
                xml('query',
                    { xmlns: 'jabber:iq:register' },
                    xml( 'username', {}, username ),
                    xml( 'password', {}, password ),
                    xml( 'number', {}, number )
                ),
                xml('error', 
                    { code: '409', type: 'cancel'},
                    xml('error', 
                        { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' } 
                    )
                )
            )
            await xmpp.send( errorStanza )
            return
        }
            
        await redis.setAsync( keys.userAccountSid, username )
        await redis.setAsync( keys.userAuthToken, password )
        await redis.setAsync( keys.userNumber, number )

        const successStanza = xml('iq',
            {to: origin.from, from: origin.to, type: 'result'},
        )
        await xmpp.send( successStanza )
    }
}

module.exports = handleIncomingIq
