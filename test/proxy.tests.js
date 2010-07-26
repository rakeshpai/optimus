var sys = require('sys');
var assert = require('assert');

require.paths.unshift("./src");
require.paths.unshift("./lib");

var mixin = require('mixin');

var proxymodule = mixin.mix('./src/proxy.js', {});

function fakeResponseStream(expectedStatus, expectedHeaders, expectedBody) {
	var seenStatusAndHeaders, seenBody;
	var ended = false;
	
	return {
		writeHead: function(status, headers) {
			assert.equal(expectedStatus, status);
			for(var key in expectedHeaders)
				assert.deepEqual(expectedHeaders[key], headers[key]);

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

exports['The proxy should work with plain text'] = function () {
	var serverResponse = fakeResponseStream(200, {"Content-Type": "text/plain"}, "test");
	var clientResponse = {statusCode: 200, body: "test", headers: {"Content-Type": "text/plain"}};
	proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
	assert.ok(serverResponse.ended());
};

exports['The proxy should work with plain text'] = function () {
	var serverResponse = fakeResponseStream(200, {"Content-Type": "text/html"}, "<h1>test</h1>");
	var clientResponse = {statusCode: 200, body: "<h1>test</h1>", headers: {"Content-Type": "text/html"}};
	proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
	assert.ok(serverResponse.ended());
};

exports['HTML content should be minified.'] = function () {
	var serverResponse = fakeResponseStream(200, {"Content-Type": "text/html"}, "<a href=test.html\>test</a>");
	var clientResponse = {statusCode: 200, body: "<a           href=\"test.html\"  >test</a>", headers: {"Content-Type": "text/html"}};
	proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
	assert.ok(serverResponse.ended());
};

exports['All headers in the response to the proxied request should be sent to the client'] = function () {
	var serverResponse = fakeResponseStream(200, {"Content-Type": "TEXT/HTML"}, "<a href=test.html>test</a>");
	var clientResponse = {statusCode: 200, body: "<a           href=\"test.html\"  >test</a>", headers: {"Content-Type": "TEXT/HTML"}};
	proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
	assert.ok(serverResponse.ended());
};

exports['The Content-Type header should be found even if it\'s all in small case.'] = function () {
	var serverResponse = fakeResponseStream(200, {"content-type": "TEXT/HTML"}, "<a href=test.html>test</a>");
	var clientResponse = {statusCode: 200, body: "<a           href=\"test.html\"  >test</a>", headers: {"content-type": "TEXT/HTML"}};
	proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
	assert.ok(serverResponse.ended());
};

exports['A request should attempt to proxy the request if not cached, else attempt to serve the cached response.'] = function() {
	var proxymodule = mixin.mix('./src/proxy.js', {});
	var cache = proxymodule.cache;

	var serverResponse = fakeResponseStream(200, {"content-type": "TEXT/HTML"}, "<a href=test.html>test</a>");
	var clientResponse = {statusCode: 200, body: "<a           href=\"test.html\"  >test</a>", headers: {"content-type": "TEXT/HTML"}};
	var called = [];

	var ifCached = function (serverRequest, serverResponse) { assert.equal("notcached", called[0]); called[called.length] = "cached"; };
	var ifNotCached = function (serverRequest, serverResponse) { called[called.length] = "notcached"; cache.addBody(serverRequest); };

	proxymodule.process_request({url: "/check-cached", host: "test.com"}, serverResponse, ifCached, ifNotCached);
	proxymodule.process_request({url: "/check-cached", host: "test.com"}, serverResponse, ifCached, ifNotCached);

	assert.equal("cached", called[1]);
};

exports['A cached response gets correctly served by the cached response handler.'] = function() {
	var proxymodule = mixin.mix('./src/proxy.js', {});
	var cache = proxymodule.cache;

	var request = {url: "/test", host: "test.com"};
	cache.addBody(request, "<a href=test.html>test</a>");

	var serverResponse = fakeResponseStream(200, {"Content-Type": "text/html"}, "<a href=test.html>test</a>");

	proxymodule.cached_response(request, serverResponse);
	assert.ok(serverResponse.ended());
};

exports['A response not yet cached is cached immediately.'] = function () {
	var proxymodule = mixin.mix('./src/proxy.js', {});
	var cache = proxymodule.cache;

	var request = {url: "/test10", host: "test.com"};
	var serverResponse = fakeResponseStream(200, {"Content-Type": "text/html"}, "<h1>test</h1>");
	var clientResponse = {statusCode: 200, body: "<h1>test</h1>", headers: {"Content-Type": "text/html"}};

	proxymodule.process_response(request, clientResponse, serverResponse);
	assert.ok(serverResponse.ended());
	assert.equal("<h1>test</h1>", cache.getBody(request));
};

exports['A response with status code 200 should have an appropriate etag.'] = function () {
	var proxymodule = mixin.mix('./src/proxy.js', {});

	var request = {url: "/test10", host: "test.com"};
	var serverResponse = fakeResponseStream(200, {"Content-Type": "text/html", "Etag": "d4843947f74305a3747dfcc0d25a38fe"}, "<h1>test</h1>");
	var clientResponse = {statusCode: 200, body: "<h1>test</h1>", headers: {"Content-Type": "text/html"}};

	proxymodule.process_response(request, clientResponse, serverResponse);
	assert.ok(serverResponse.ended());
}
