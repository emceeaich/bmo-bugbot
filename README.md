Bugbot Server
==============

A node.js app that responses to requests for a Slack App for looking up bugs
and their status on bugzilla.mozilla.org.

The bot is invoked by `/bug [bug id]` in the Slack, or just mentioning `bug
[bug id]` in discussion. Depending on configuration of the app, the bot needs
to be invited to the relevant channels.

If you request `/bug help` you will get a help message.

App Setup
---------

This bot requires an App to setup. The following steps will help you on your
way:

1. In the *Bot Users* section, add a bot with your preferred name (`firebot`,
   of course)

2. In the *OAuth & Permissions* section, add the `chat:write:bot` permission.

3. Force the generation of a Verification Token: If you just created your Slack
   App, the Basic Information section of your configuration will not yet have a
   Verification Token under App Credentials. By visiting the *Event
   Subscriptions* section and putting a dummy URL into Request URL, you will
   get a verification failure, but also there will now be a Verification Token
   available in the Basic Information section.

4. Start the verification tool: `./node_modules/.bin/slack-verify --token
   <token> [--path=/slack/events] [--port=3000]`. You will need to substitute
   your own Verification Token for `<token>`. You may also want to choose your
   own `path` and/or `port`.

5. Head over to the *Event Subscriptions* section and fill out the request URL
   field, e.g. `https://example.com/slack/events`. Then, subscribe to
   `message.channels` team events. Alternatively, if you only want the bot to
   respond in channels he is invited to, add the same topic to the bot events
   section.

6. In the *Slash Commands* section, create a new command `/bug` that points to
   e.g. `https://example.com/bug` and describe it properly.

Running the Bot
----------------

The bot uses environment variables for setup. You'll need two different tokens
and a port number to run on:

    PORT=3000 \
    SLACK_VERIFICATION_TOKEN=<token from Basic Information section> \
    SLACK_ACCESS_TOKEN=xoxp-<token from OAuth & Permissions section> \
    node server.js

The `SLACK_VERIFICATION_TOKEN` is from the *Basic Information* section in the
App Credentials. The `SLACK_ACCESS_TOKEN` is from the *OAuth & Permissions*
section, either the OAuth Access Token if you want to make it an instance-wide
feature, or the Bot User OAuth Access Token if you want it to be a per-channel
feature.
