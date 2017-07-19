// server.js
// where your node app starts

// init project
var express = require('express');
var bodyParser = require('body-parser');
var httpinvoke = require('httpinvoke');
var readable = require('bugzilla-readable-status').readable;
var WebClient = require('@slack/client').WebClient;

var createSlackEventAdapter = require('@slack/events-api').createSlackEventAdapter;
var slackEvents = createSlackEventAdapter(process.env.SLACK_VERIFICATION_TOKEN);
var slackClient = new WebClient(process.env.SLACK_ACCESS_TOKEN);

//TODO: this is incomplete and the list of error codes appears to be missing from bugzilla documentation
//      will have to dig through the REST API source to find all the values
var error_codes = {
  100: "This is not a valid bug number.",
  101: "This bug does not exist in bugzilla.mozilla.org",
  102: "This bug is restricted to users in a group this bot is not part of, if you have access to it, you will need to view it on bugzilla.mozilla.org"
}

var app = express(); //TOFIX: what's the Sinatra of Node.js?


app.use(bodyParser.urlencoded({
  type: "application/x-www-form-urlencoded",
  extended: false
}));

app.use('/slack/events', bodyParser.json(), slackEvents.expressMiddleware());

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.post("/bug", function (request, response) {
  // is this a legit request
  if (!isValidRequestToken(request.body.token)) {
    response.sendStatus(400);
    return;
  }
  
  // handle help request
  if (request.body.text.toLowerCase() === 'help') {
    response.send('I take the number of a bug on bugzilla.mozilla.org as an argument.');
    return;
  }
  
  // let the requestor know we are working on it
  response.send(200, 'I am looking up bug ' + request.body.text + ' for you.');
  
  // do the lookup
  lookup(request.body.text, request.body.user_name, request.body.user_id, request.body.response_url);
});

slackEvents.on('message', function(event) {
  let bugs = getBugNumbers(event.text);

  if (event.bot_id || !bugs.size) {
    return;
  }

  Promise.all([...bugs.values()].map(id => getBug(id))).then(function(results) {
    for (let [id, data] of results) {
      respondToBug(id, event.channel, data);
    }
  }, function(err) {
    console.error(err);
  });
});
slackEvents.on('error', console.error);

/**
  Validate request
  returns: boolean
*/
function isValidRequestToken(token) {
  return (token == process.env.SLACK_VERIFICATION_TOKEN)
}

/**
  Look up bug, handle success and failure
  returns: null
*/ 
function lookup(bugId, requestor, requestorId, responseURL) {
  
  // let's find the bug
  getBug(bugId).then(([id, data]) => {
    var errorMessage;
    
    if (data.bugs) {
      returnStatus(data.bugs[0], requestor, requestorId, responseURL);
    } else {
      errorMessage = error_codes[data.code] || 'I could not find this bug for an unspecified reason.';
      returnStatusError(errorMessage, responseURL);
    }
    
  }, function(err) {
    returnStatusError('I am unable to contact bugzilla.mozilla.org to find this bug.', responseURL);
  });
}
  
function returnStatus(data, requestor, requestorId, responseURL) {
  
  var URL = 'https://bugzilla.mozilla.org/show_bug.cgi?id=' + data.id;
  
  var readableStatus = readable(data);
  
  // prepare response
  var response = {
    response_type: "in_channel",
    text: "Here is the information on a bug which <@" + requestor + "|" + requestorId + "> asked about:",
    attachments: [
      {
        title: '<' + URL + '|Bug ' + data.id + '>: ' + data.summary,
        text: readableStatus,
        mrkdwn_in: ["title", "text"],
        fallback: URL + ' - ' + data.summary + ': ' + readableStatus
      },
    ],
    mrkdwn: true
  };
  
  postResponse(responseURL, response);
}

function returnStatusError(message, responseURL) {  
  var response = {
    response_type: "ephemeral", 
    text: message,
    fallback: message,
    color: 'warning'
  };
  
  postResponse(responseURL, response);
}

function postResponse(responseURL, response) {
  // POST response back to Slack
  httpinvoke(responseURL, 'POST', {
    headers: {
      'Content-Type': "application/json"
    },
    input: JSON.stringify(response)
  }, function(err) {
    if (err) {
      console.log('Failed to post response to Slack', err);
    } else {
      console.log('Posted response to Slack')
    }
  });
}

/**
  Retrieve the bug with the given bug number using the REST api.
  returns: an array [bugid, jsondata]
*/
function getBug(bugId) {
  return httpinvoke('https://bugzilla.mozilla.org/rest/bug/' + bugId, 'GET').then(function(res) {
    return [bugId, JSON.parse(res.body)];
  });
}

/**
  Send information about a specific bug to a channel via slack client
  returns: null
*/
function respondToBug(bugId, channel, data) {
  let response, attachments;

  if (data.bugs && data.bugs.length) {
    let bug = data.bugs[0];
    response = `https://bugzil.la/${bug.id} — ${bug.resolution}, ${bug.assigned_to} — ${bug.summary}`;
    attachments = [{ text: readable(bug) }];
  } else if (data.code == 101) {
    response = `<https://bugzil.la/${bugId}|bug ${bugId}> was not found`;
  } else if (data.code == 102) { /* restricted group */
    response = `<https://bugzil.la/${bugId}|bug ${bugId}> is not accessible`;
  }

  if (response) {
    let opts = { as_user: false, unfurl_links: false, unfurl_media: false, mrkdwn: false, attachments: attachments };
    slackClient.chat.postMessage(channel, response, opts);
  }
}

/**
  Retrieves unique bug numbers from the passed string
  returns: A Set with the detected bug numbers
*/
function getBugNumbers(str) {
  let regex = /(?:^|\s)bug\s+(\d+)(?:[^\d]|$)/ig;
  let results = new Set();

  let match;
  while ((match = regex.exec(str)) !== null) {
    results.add(match[1]);
  }

  return results;
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
