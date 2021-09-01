# sgx-twilio: Bridge between Twilio SMS and XMPP
Simple bridge to allow the use of a twilio phone number to be used for messaging using any XMPP client, such as Conversations.

## Sending SMS from Phone Numbers
The service is set up so you can have 1 phone number per each xmpp account.

To set up your phone number. You will need to get from Twilio:
- Account SID
- Auth token
- Phone Number

Then message the admin bot ( COMPONENT\_DOMAIN ) from your xmpp account with message 'register' and follow the steps.
Message 'cancel' or 'help' at any time to return to the help section.

## Recieving SMS from phone numbers
1. Go to `https://console.twilio.com`
2. Go to Develop > Phone Numbers > Manage > Active Numbers
3. Click on the phone number you want to add
4. Go to the Configure tab
5. Scroll down to 'Messaging' and change 'A message Comes in' to the url you are hosting the web app on. For example: `https://twilio.sgx.domain.tld/sms`

## Installation:
### Bare installation
Required:
- nodejs >= 14
- redis server
- xmpp server that supports components ( eg: prosody )

Installation:
1. Clone the Repo
```
git clone https://github.com/pesvut/sgx-twilio
```

2. Install the nodejs packages
```
cd ./sgx-twilio && npm install
```

3. Run the server with environmental variables

| Variable | Description |
| -------- | ----------- |
| XMPP\_ADMIN | (optional) Who to send messages regarding updates and missing messages |
| COMPONENT\_HOST | Host for the Xmpp instance component in format "xmpp(s)://xmpp-instance:5347" ( default: "xmpp://prosody:5347" ) |
| COMPONENT\_DOMAIN | Domain of the component this is, eg: 'twilio.sgx.domain.tld' |
| COMPONENT\_SECRET | Component Secret / password to administer the xmpp component |
| REDIS\_URL | redis instance to connect to ( or default redis if not present ) |
| PORT | port to host the web server for recieving messages ( default: 80 ) |
| XMPP\_ADMIN= COMPONENT\_HOST= COMPONENT\_DOMAIN= COMPONENT\_SECRET= REDIS\_HOST= REDIS\_PORT= PORT= node server.js

```
XMPP\_ADMIN= COMPONENT\_HOST= COMPONENT\_DOMAIN= COMPONENT\_SECRET= REDIS\_URL= PORT= node server.js
```

### Docker Installation
An all-in one docker-compose file for running redis, xmpp and sgx-twilio behind an instance of nginx or apache.
Note that E2E\_POLICY\_CHAT is set to none because the server needs to be able to read the messages to bridge them.

```
version: '3.7'

services:
  prosody:
    image: sarasmiseth/prosody:latest
    restart: unless-stopped
    ports:
      - "5000:5000"
      - "5222:5222"
      - "5223:5223"
      - "5347:5347"
      - "5269:5269"
      - "5280:5280"
      - "5281:5281"
    environment:
      DOMAIN: domain.tld
      COMPONENT_SECRET:
      E2E_POLICY_CHAT: none
      LOG_LEVEL: info
    volumes:
      - ./certs:/usr/local/etc/prosody/certs
      - ./data:/usr/local/var/lib/prosody
      - ./config:/usr/local/etc/prosody
    networks:
      - xmpp
 
  sgx-twilio:
    build: https://github.com/pesvut/sgx-twilio.git
    image: sgx-twilio
    restart: unless-stopped
    ports:
      - "5069:80"
    environment:
      COMPONENT_HOST: "xmpp://prosody:5347"
      COMPONENT_DOMAIN: twilio.sgx.domain.tld
      COMPONENT_SECRET: 
      REDIS_URL: "redis://redis-twilio"
      XMPP_ADMIN: admin@domain.tld
    networks:
      - xmpp

  redis-twilio:
    image: redis:latest
    restart: always
    networks:
      - xmpp
    volumes:
      - ./redis:/data

networks:
  xmpp:
    name: xmpp
```

You will need to also do the following:
- add cert folders to `/certs` for each of the following domains ( see https://github.com/SaraSmiseth/prosody for more information on setting up your xmpp )
    - conference.domain.tld
    - domain.tld
    - media.domain.tld
    - proxy.domain.tld
- add a configuration file for the new component, `config/conf.d/06-components.cfg.lua`:
```
local comp_secret = os.getenv("COMPONENT_SECRET")

Component "twilio.sgx.domain.tld"
    component_secret = comp_secret

```
