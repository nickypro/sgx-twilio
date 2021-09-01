const { getUserState, newMessage } = require( './helper' )
const { xml } = require("@xmpp/component");

// Code for handling when a user sends a <message> stanza to the server
async function handleIncomingIq( xmpp, redis, stanza ) {
    const origin = {
        from: stanza.attrs.from,
        to: stanza.attrs.to,
        id: stanza.attrs.id,
        type: stanza.attrs.type,
        query: stanza.getChild('query'),
    }
    const user = getUserState( redis, origin.from.split("/")[0] )

    if ( !origin.query ) {
        await xmpp.send( newMessage( "Invalid iq request: no query", origin.to ) )
        return
    }
    
    const xmlns = origin.query.attrs.xmlns
    if ( origin.query.attrs.xmlns != "jabber:iq:register" ) {
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
            {to: origin.from, from: origin.to, type: 'result', id: origin.id},
            xml(
                'query',
                { xmlns: 'jabber:iq:register' },
                xml( 'instructions', {}, instructions ),
                xml( 'username', {} ),
                xml( 'password', {} ),
                xml( 'number', {} )
            )
        )
console.log("form", registrationForm);
        await xmpp.send( registrationForm )
    }
    
    if ( origin.type == "set" ) {
        const username = origin.query.getChild( 'username' )
        const password = origin.query.getChild( 'password' )
        const number   = origin.query.getChild( 'number' )

        if ( !username || !password || !number || !/^\+\d+$/.text( number.text() ) ) {
            const errorStanza = xml(
                'iq',
                {to: origin.from, from: origin.to, type: 'error', id: origin.id},
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
                {to: origin.from, from: origin.to, type: 'error', id: origin.id},
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
        

        await user.accountSid.set( username )
        await user.authToken.set( username )
        await user.phoneNumber.set( username )

        const successStanza = xml('iq',
            {to: origin.from, from: origin.to, type: 'result', id: origin.id},
        )
        await xmpp.send( successStanza )
    }
}

module.exports = handleIncomingIq
