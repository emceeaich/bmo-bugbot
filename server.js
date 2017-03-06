// server.js
// where your node app starts

// init project
var express = require('express');
var bodyParser = require('body-parser');
var httpinvoke = require('httpinvoke');
var readable = require('bugzilla-readable-status').readable;

var error_codes = {
  100: "This is not a valid bug number.",
  101: "This bug does not exist in bugzilla.mozilla.org",
  102: "This bug is in a security group, if you have access to it, you will need to view it on bugzilla.mozilla.org"
}

var app = express(); //TOFIX: what's the Sinatra of Node.js?

app.use(bodyParser.urlencoded({
  type: "application/x-www-form-urlencoded"
}));

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.post("/bug", function (request, response) {
  
  console.log(request.body);
  
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
  response.send('I am looking up bug ' + request.body.text + ' for you.');
  
  // do the lookup
  lookup(request.body.text, request.body.user_name, request.body.user_id, request.body.response_url);

});

/**
  Validate request
  returns: boolean
*/
function isValidRequestToken(token) {
  return (token === process.env.TOKEN)
}

/**
  Look up bug, handle success and failure
  returns: null
*/ 
function lookup(bugId, requestor, requestorId, responseURL) {
  
  // let's find the bug
  httpinvoke('https://bugzilla.mozilla.org/rest/bug/' + bugId, 'GET').then(function(res) {

    var errorMessage;
    var data = JSON.parse(res.body);
        
    console.log(data);
    
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
  
  // prepare response
  var response = {
    response_type: "in_channel",
    text: "Here is the information on a bug which <@" + requestor + "|" + requestorId + "> asked about:",
    attachments: [
      {
        title: '<' + URL + '|Bug ' + data.id + '>: ' + data.summary,
        text: readable(data),
        mrkdwn_in: ["title", "text"]
      },
    ],
    mrkdwn: true
  };
  
  postResponse(responseURL, response);
}

function returnStatusError(message, responseURL) {  
  var response = {
    response_type: "ephemeral", 
    text: message
  };
  
  postResponse(responseURL, response);
}

function postResponse(responseURL, response) {

  console.log(response);
  
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

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
