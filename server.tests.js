var fs = require('fs');
var sys = require('sys');
var assert = require('assert');

var mixin = require('./mixin');

var servermodule = mixin.mix("./server.js", {});

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

var testRequest = (function (context) {
	return function(url, status, headers, response) {
		context.requestProcessor(requestForUrl(url), fakeResponseStream(status, headers, response));
	};
})(servermodule);

var testRequestForHTMLUrl = (function (context) {
	return function(url, response) {
		testRequest(url, 200, htmlContentTypeResponseHeader, response);
	};
})(servermodule);

testRequestForHTMLUrl("/test.html", "test data");
testRequestForHTMLUrl("/hello/world.html", "hi");
testRequestForHTMLUrl("/hello/", "<a href=\"/hello/world.html\">world.html</a>");
testRequestForHTMLUrl("/hello", "<a href=\"/hello/world.html\">world.html</a>");
testRequest("/file-does-not-exist.html", 404, {"Content-Type": "text/plain"}, "/file-does-not-exist.html - File not found");

(function () {
	var cache = new servermodule.Cache();
	var req = requestForUrl("/test.html");

	cache.add(req, "test cached data");

	assert.ok(cache.has(req));
	assert.equal("test cached data", cache.get(req));
})();

(function () {
	var timesItHappened = 0;

	var nextHandler = function(req, res) { servermodule.cache.add(req, "cached data"); timesItHappened ++; assert.equal(1, timesItHappened); };

	for(var i = 0; i < 2; i ++) {
		servermodule.cachingRequestProcessor(requestForUrl("cached-data.html"), fakeResponseStream(200, htmlContentTypeResponseHeader, "cached data"), nextHandler);
	}

	setTimeout(function () { assert.equal(1, timesItHappened); }, 0);

	servermodule.fileSystemRequestProcessor(requestForUrl("/test.html"), fakeResponseStream(200, htmlContentTypeResponseHeader, "test data"));
	setTimeout(function () { assert.ok(servermodule.cache.has(requestForUrl("/test.html"))); }, 0);
})();
