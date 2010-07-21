var mixin = require('./mixin');
var assert = require('assert');
var proxymodule = mixin.mix('./proxy.js', {});

function fakeResponseStream(expectedStatus, expectedHead, expectedBody) {
	var seenStatusAndHeaders, seenBody;
	var ended = false;
	
	return {
		writeHead: function(status, headers) {
			assert.equal(expectedStatus, status);
			assert.deepEqual(expectedHead, headers);
			
			seenStatusAndHeaders = true;
		},

		write: function(chunk, encoding) {
			assert.equal(expectedBody, chunk);
			seenBody = true;
		},

		end: function() {
			assert.ok(seenStatusAndHeaders, "Should have seen response headers and status");
			assert.ok(seenBody, "Should have seen response body");
			ended = true;
		},

		ended: function() { return ended; },
	};
}

var serverResponse = fakeResponseStream(200, {"Content-Type": "text/plain"}, "test");
var clientResponse = {body: "test", headers: {"Content-Type": "text/plain"}};
proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
assert.ok(serverResponse.ended());

var serverResponse = fakeResponseStream(200, {"Content-Type": "text/html"}, "<h1>test</h1>");
var clientResponse = {body: "<h1>test</h1>", headers: {"Content-Type": "text/html"}};
proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
assert.ok(serverResponse.ended());

var serverResponse = fakeResponseStream(200, {"Content-Type": "text/html"}, "<a href=test.html\>test</a>");
var clientResponse = {body: "<a           href=\"test.html\"  >test</a>", headers: {"Content-Type": "text/html"}};
proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
assert.ok(serverResponse.ended());

var serverResponse = fakeResponseStream(200, {"Content-Type": "TEXT/HTML"}, "<a href=test.html>test</a>");
var clientResponse = {body: "<a           href=\"test.html\"  >test</a>", headers: {"Content-Type": "TEXT/HTML"}};
proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
assert.ok(serverResponse.ended());

var serverResponse = fakeResponseStream(200, {"content-type": "TEXT/HTML"}, "<a href=test.html>test</a>");
var clientResponse = {body: "<a           href=\"test.html\"  >test</a>", headers: {"content-type": "TEXT/HTML"}};
proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
assert.ok(serverResponse.ended());
