var fs = require('fs');
var sys = require('sys');
var assert = require('assert');

var mixin = require('./mixin');

mixin.mix("./server.js", this);

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

		ended: function() { return ended; }
	};
}

var htmlContentTypeResponseHeader = {"Content-Type": "text/html"};

function requestForUrl(url) {
	return {url: url, method: "GET"};
}

function testRequest(context, url, status, headers, response) {
	context.requestProcessor(requestForUrl(url), fakeResponseStream(status, headers, response));
}

function testRequestForHTMLUrl(context, url, response) {
	testRequest(context, url, 200, htmlContentTypeResponseHeader, response);
}

// for(var key in this) { sys.puts (key + '=' + this[key]); }

exports.stuff = testRequestForHTMLUrl;

this.stuff(this, "/test.html", "test data");
testRequestForHTMLUrl(this, "/hello/world.html", "hi");
testRequestForHTMLUrl(this, "/hello/", "<a href=\"/hello/world.html\">world.html</a>");
testRequestForHTMLUrl(this, "/hello", "<a href=\"/hello/world.html\">world.html</a>");
testRequest(this, "/file-does-not-exist.html", 404, {"Content-Type": "text/plain"}, "/file-does-not-exist.html - File not found");

(function (context) {
	var cache = new context.Cache();
	var req = requestForUrl("/test.html");

	cache.add(req, "test cached data");

	assert.ok(cache.has(req));
	assert.equal("test cached data", cache.get(req));
})(this);

(function (context) {
	var timesItHappened = 0;

	var nextHandler = function(req, res) { context.cache.add(req, "cached data"); timesItHappened ++; assert.equal(1, timesItHappened); };

	for(var i = 0; i < 2; i ++) {
		context.cachingRequestProcessor(requestForUrl("cached-data.html"), fakeResponseStream(200, htmlContentTypeResponseHeader, "cached data"), nextHandler);
	}

	setTimeout(function () { assert.equal(1, timesItHappened); }, 0);

	context.fileSystemRequestProcessor(requestForUrl("/test.html"), fakeResponseStream(200, htmlContentTypeResponseHeader, "test data"));
	setTimeout(function () { assert.ok(context.cache.has(requestForUrl("/test.html"))); }, 0);
})(this);
