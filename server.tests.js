var fs = require('fs');
var sys = require('sys');
var assert = require('assert');

var mixin = require('./mixin');

mixin.mix("./server.js", this);

function fakeResponseStream(expectedStatus, expectedHead, expectedBody) {
	var seenStatusAndHeaders, seenBody;
	
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
		}
	};
}

var htmlContentTypeResponseHeader = {"Content-Type": "text/html"};

function requestForUrl(url) {
	return {url: url, verb: "GET"};
}

function testRequestForHTMLUrl(context, url, response) {
	context.requestprocessor({url: url}, fakeResponseStream(200, htmlContentTypeResponseHeader, response));
}

function testRequest(context, url, status, headers, response) {
	context.requestprocessor({url: url}, fakeResponseStream(status, headers, response));
}

testRequestForHTMLUrl(this, "/test.html", "test data");
testRequestForHTMLUrl(this, "/hello/world.html", "hi");
testRequestForHTMLUrl(this, "/hello/", "<a href=\"/hello/world.html\">world.html</a>");
testRequestForHTMLUrl(this, "/hello", "<a href=\"/hello/world.html\">world.html</a>");
testRequest(this, "/file-does-not-exist.html", 404, {"Content-Type": "text/plain"}, "/file-does-not-exist.html - File not found");
assert.equal("data from file", this.getFromCache(requestForUrl("from-file.html"), function() { return "data from file"; }));
(function (context) {
	var timesCalled = {count: 1};

	var returnFromCacheAfterFetchingOnceFromFile = function() {
		timesCalled.count += 1;
		assert.equal(1, timesCalled.count);
		return "data from file";
	};

	for(var i = 0; i < 3; i++) {
		assert.equal("data from file", context.getFromCache(requestForUrl("from-file.html"), returnFromCacheAfterFetchingOnceFromFile));
	}

	assert.equal(1, timesCalled.count);
})(this);
(function (context) {
	var cache = new context.Cache();
	var req = requestForUrl("/test.html");

	cache.add(req, "test cached data");

	assert.ok(cache.has(req));
	assert.equal("test cached data", cache.get(req));
})(this);

// testRequestForHTMLUrl(this, "/fromfile.html", this.getFromCache(requestForUrl("from-file.html"), function() { return "data from file"; }));
