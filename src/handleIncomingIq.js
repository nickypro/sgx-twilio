const { getUserState, newMessage } = require( './helper' )
const { testUserCredentials, setPhoneSid, setupPhoneUrl } = require( './twilioFunctions' )
const { xml } = require("@xmpp/component");

const FIELD_DATA = {
    accountSid : { help: 'Twilio Account SID', required: true },
    authToken  : { help: 'Twilio Auth Token', required: true },
    phoneNumber: { help: 'Twilio Phone Number ( with + )', required: true }, 
}
const FIELD_NAMES = Object.keys( FIELD_DATA )

// XEP-0077: Send registration form to the user when requested
function handleGetIq() {
    const instructions = 'Please enter ' + 
        ' your Twilio Account SID, Twilio Auth Token, and the Phone number' +
        ' ( in E.164 format ) you would like to use with this account'

    const field = ( varName ) => {
        const { help, required } = FIELD_DATA[ name ]
        const children = []
        if ( required ) children.push( xml( 'required', {} ) )
        return xml( 'field', 
                    { 'type': 'text-single', 'var': varName, 'label': help }, 
                    ...children )
    }

    const fields = FIELD_NAMES.map( name => field( name ) )

    const registrationForm = xml(
        'query',
        { xmlns: 'jabber:iq:register' },
        xml( 'x', { type: 'form', xmlns:'jabber:x:data' },
            xml( 'title', {}, "Register Gateway to XMPP - Twilio" ),
            xml( 'instructions', {}, instructions ),
            ...fields,
        )
    )
    return registrationForm
}

// generate XML for an XMPP error
function errStanza( err ) {
    console.error( "Registration Error:", err )
    const output = {}
    switch ( err.code || '' ) {
        case 406:
            output.code = '406'
            output.type = 'modify'
            output.meaning = 'not-acceptable'
            output.msg = err.msg
            break;
        case 409:
        default:
            output.code = '409'
            output.type = 'cancel'
            output.meaning = 'conflict'
            output.msg = err.msg || err.message || err
            break;
    }

     const newErrStanza = ({ code, type, meaning, msg }) => {
         return xml('error', 
            { code, type, xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' },
            xml( meaning, {}, msg )
        )
     }

    return error
}

// Code for handling when a user sends a registration form to the server
// should only run for <iq type="set"...><query xmlns="jabber:iq:register">...
async function handleSetIq( xmpp, redis, stanza ) {
    const origin = {
        from: stanza.attrs.from,
        to: stanza.attrs.to,
        id: stanza.attrs.id,
        type: stanza.attrs.type,
        query: stanza.getChild('query'),
    }

    // handle errors
    let err = null

    // ensure the form is at least structurally correct
    const x = origin.query.getChild( 'x' )
    if ( ! x ) return errStanza({ code: 406, msg: 'No form found' })

    const fields = x.getChildren( 'field' )
    if ( fields.length < 3 || fields.length > FIELD_NAMES.length ) 
        return errStanza({ code: 406, msg: 'Incorrect number of entries' })


    // get fields: iq > query > x > field and put it into user state if correct
    const user = getUserState( redis, origin.from.split("/")[0] )
    console.log( `handling stanza type=${ origin.type }, from=${ origin.from }` )

    const data = {}
   
    // get xml objects from form
    for ( const fieldName of FIELD_NAMES ) {
        data[ fieldName ] = fields.find( field => field.attrs.var == fieldName )
        if ( FIELD_DATA[ fieldName ].required && !data[ fieldName ] )
            return errStanza({ code: 406, msg: `Missing Field: ${ fieldName }`} )
    }

    // get text from xml objects
    for ( const fieldName of FIELD_NAMES ) {
        if ( data[ fieldName ] ) {
            data[ fieldName ] = data[ fieldName ].text()
            if ( FIELD_DATA[ fieldName ].required && !data[ fieldName ] )
                return errStanza({ code: 406, msg: `Missing Field: ${ fieldName }`} )
        }
    }

    // ensure phone number looks like +12345678012
    if ( !/^\+\d+$/.test( data.phoneNumber ) ) {
        return errStanza({ 
            code: 406, msg: 'Invalid phone number, must be in E.164 format'
        }) 
    }

    // set the user data in redis
    await user.set({ 
        accountSid: data.accountSid,
        authToken: data.authToken,
        phoneNumber: data.phoneNumber,
    })

    // ensure the credentials are correct
    err = await testUserCredentials( user )
    if ( err ) {
        console.log("credentials NOT OK") 
        return errStanza({ code: 409, msg: err.message })
    } else {
        console.log("credentials OK")
    }

    // if correct, check that the number isn't used by another account
    const currentNumberOwner = await redis.getAsync( data.phoneNumber )
    if ( currentNumberOwner && currentNumberOwner != origin.from.split("/")[0] ) {
        console.log( `number ${ data.phoneNumber } belongs to ${ currentNumberOwner }: ` )
        return errStanza({
            code: 409, msg: 'Phone number used by someone else'
        })
    }

    // success
    console.log(`Successful registration for ${ origin.from }: `,
        `${ data.accountSid } ${ data.authToken } ${ data.phoneNumber }`)

    await redis.setAsync( data.phoneNumber, origin.from.split("/")[0] )
    await setPhoneSid( user )
    setupPhoneUrl( user )

    return true
}

module.exports = {
    handleGetIq,
    handleSetIq
}
