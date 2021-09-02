const { getUserState, newMessage, testUserCredentials } = require( './helper' )
const { xml } = require("@xmpp/component");

// XEP-0077: Send registration form to the user when requested
function handleGetIq() {
    const instructions = 'Please enter ' + 
        ' your Twilio Account SID ( username ),' + 
        ' Twilio Auth Token ( password ), and the Phone number ( number ) ' +
        ' ( in E.164 format ) you would like to use with this account'
    const registrationForm = xml(
        'query',
        { xmlns: 'jabber:iq:register' },
        xml( 'instructions', {}, instructions ),
        xml( 'username', {} ),
        xml( 'password', {} ),
        xml( 'number', {} )
    )
    return registrationForm
}

// Code for handling when a user sends a registration form to the server
async function handleSetIq( xmpp, redis, stanza ) {
    // should only run for <iq type="set"...><query xmlns="jabber:iq:register">...
    function errStanza( err ) {
        console.error( "Registration Error:", err )
        const output = {}

        switch ( err.code || '' ) {
            case '406':
                output.code = err.code
                output.type = 'modify'
                output.meaning = 'not-acceptable'
                output.msg = err.msg
                break;
            case '409':
            default:
                output.code = '409'
                output.type = 'cancel'
                output.meaning = 'conflict'
                output.msg = err.msg || err.message || err
                break;
        }

         const newErrStanza = ({ code, type, meaning, msg }) => {
             xml('error', 
                { code, type, xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' },
                xml( meaning, {}, msg )
            )
         }

        return newErrStanza( output )
    }

    const origin = {
        from: stanza.attrs.from,
        to: stanza.attrs.to,
        id: stanza.attrs.id,
        type: stanza.attrs.type,
        query: stanza.getChild('query'),
    }

    const user = getUserState( redis, origin.from.split("/")[0] )
    console.log( `handling stanza type=${ origin.type }, from=${ origin.from }` )
    
    const username = origin.query.getChild( 'username' )
    const password = origin.query.getChild( 'password' )
    const number   = origin.query.getChild( 'number' )

    if ( !username || !password || !number ) {
        return errStanza({ code: '406', msg: 'Missing Fields'} )
    }  
    if ( !/^\+\d+$/.test( number.text() ) ) {
        return errStanza({ 
            code: '406', msg: 'Invalid phone number, must be in E.164 format'
        }) 
    }

    await user.set({ 
        accountSid: username.text(),
        authToken: password.text(),
        phoneNumber: number.text(),
    })

    const err = await testUserCredentials( user )
    if ( err ) {
        console.log("credentials NOT OK") 
        return errStanza({
            code: '409', msg: err.message
        })
    } else {
        console.log("credentials OK")
    }

    const currentNumberOwner = await redis.getAsync( number.text() )
    if ( currentNumberOwner && currentNumberOwner != origin.from.split("/")[0] ) {
        console.log( `number ${number.text()} belongs to ${currentNumberOwner}: ` )
        return errStanza({
            code: '409', msg: 'Phone number used by someone else'
        })
    }

    console.log(`Successful registration for ${ origin.from }: `,
        `${ username.text() } ${ password.text() } ${ number.text() }`)

    await redis.setAsync( number.text(), origin.from.split("/")[0] )

    return true
}

module.exports = {
    handleGetIq,
    handleSetIq
}
