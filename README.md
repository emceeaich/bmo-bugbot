Bugbot Server
==============

A node.js app that responses to requests for a Slack App for looking up bugs
and their status on bugzilla.mozilla.org.

The bot is invoked by `/bug [bug id]` in the Slack.

If you request `/bug help` you will get a help message.

The integration should be slash-command with `https://bugbot.gomix.me/` as 
the endpoint.