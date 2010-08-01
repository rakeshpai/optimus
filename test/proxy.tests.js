var sys = require('sys');
var assert = require('assert');

require.paths.unshift("./src");
require.paths.unshift("./lib");

var ducky = require('actlikeaduck');
var mixin = require('mixin');

var ignoredTests = [];

var proxymodule = mixin.mix('./src/proxy.js', {});

function fakeResponseStream(expectedStatus, expectedHeaders, expectedBody, test) {
	ducky.mock({})
		.expect("writeHead").withArgs(expectedStatus, expectedHeaders)
		.expect("write").withArgs(expectedBody, "binary")
		.expect("end")
		.playback(test);
}

exports['The proxy should work with plain text'] = function () {
	fakeResponseStream(200, {"Content-Type": "text/plain"}, "test",
		function (serverResponse, mock) {
			var clientResponse = {statusCode: 200, body: "test", headers: {"Content-Type": "text/plain"}};
			proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
		});
};

exports['HTML content should be minified.'] = function () {
	fakeResponseStream(200, {"Content-Type": "text/html"}, "<a href=test.html\>test</a>",
		function(serverResponse, mock) {
			var clientResponse = {statusCode: 200, body: "<a           href=\"test.html\"  >test</a>", headers: {"Content-Type": "text/html"}};
			proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
		});
};

exports['All headers in the response to the proxied request should be sent to the client'] = function () {
	fakeResponseStream(200, {"Content-Type": "TEXT/HTML"}, "<a href=test.html>test</a>",
		function(serverResponse) {
			var clientResponse = {statusCode: 200, body: "<a           href=\"test.html\"  >test</a>", headers: {"Content-Type": "TEXT/HTML"}};
			proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
		});
};

exports['The Content-Type header should be found even if it\'s all in small case.'] = function () {
	fakeResponseStream(200, {"content-type": "TEXT/HTML"}, "<a href=test.html>test</a>",
		function(serverResponse) {
			var clientResponse = {statusCode: 200, body: "<a           href=\"test.html\"  >test</a>", headers: {"content-type": "TEXT/HTML"}};
			proxymodule.process_response({url: "/test", host: "test.com"}, clientResponse, serverResponse);
		});
};

exports['A cached response gets correctly served from cache.'] = function() {
	var proxymodule = mixin.mix('./src/proxy.js', {});
	var cache = proxymodule.cache;

	var request = {url: "/test", host: "test.com", etag: 'd4332e8cb0bd997858b92860bf39394e'};
	var content = "<a href=test.html>test</a>";
	var responseHash = 'd4332e8cb0bd997858b92860bf39394e';
	cache.set(responseHash, "<a href=test.html>test</a>");

	fakeResponseStream(304, {"Content-Type": "text/plain"}, "Not modified",
		function(serverResponse) {
			proxymodule.process_response(request, {body: "<a   href=test.html>test</a>", headers: {"Content-Type": "text/html"}}, serverResponse);
		});
};

exports['A response not yet cached is transformed and cached before being served.'] = function () {
	var proxymodule = mixin.mix('./src/proxy.js', {});
	var cache = proxymodule.cache;

	var request = {url: "/test10", host: "test.com"};
	var clientResponse = {statusCode: 200, body: "<h1                  >test</h1>", headers: {"Content-Type": "text/html"}};

	fakeResponseStream(200, {"Content-Type": "text/html", "transfer-encoding": "chunked"}, "<h1>test</h1>",
		function(serverResponse) {
			proxymodule.process_response(request, clientResponse, serverResponse);
		});

	assert.equal("<h1>test</h1>", cache.get("d7a0c80a5b212464a9e5c9c7411da6d2"));
};

exports['Proxied response headers get sanitized before being forwarded to the client.'] = function () {
	var proxymodule = mixin.mix('./src/proxy.js', {});
	var cache = proxymodule.cache;

	var request = {url: "/test10", host: "test.com"};
	var clientResponse = {statusCode: 200, body: "<h1>test</h1>", headers: {"Content-Type": "text/html"}, etag: "tag", "last-modified": "time", "accept-ranges": "stuff", "content-length": "stuff", "connection": "stuff"};

	fakeResponseStream(200, {"Content-Type": "text/html", "transfer-encoding": "chunked"}, "<h1>test</h1>",
		function(serverResponse) {
			proxymodule.process_response(request, clientResponse, serverResponse);
		});

	assert.equal("<h1>test</h1>", cache.get("d7a0c80a5b212464a9e5c9c7411da6d2"));
};

exports['The transformed version of a response is served from cache, if available.'] = function () {
	var proxymodule = mixin.mix('./src/proxy.js', {});
	var cache = proxymodule.cache;

	var request = {url: "/test10", host: "test.com"};
	var clientResponse = {statusCode: 200, body: "<h1                  >test</h1>", headers: {"Content-Type": "text/html"}};

	cache.set('d7a0c80a5b212464a9e5c9c7411da6d2', '<h1>test</h1>');
	cache.set = function() { throw new Error("cache.set should not have been called."); };

	fakeResponseStream(200, {"Content-Type": "text/html"}, "<h1>test</h1>",
		function(serverResponse) {
			proxymodule.process_response(request, clientResponse, serverResponse);
		});
};

exports['A response with status code 200 should have an appropriate etag.'] = function () {
	var proxymodule = mixin.mix('./src/proxy.js', {});

	var request = {url: "/test10", host: "test.com"};
	var clientResponse = {statusCode: 200, body: "<h1>test</h1>", headers: {"Content-Type": "text/html"}};

	fakeResponseStream(200, {"Content-Type": "text/html", 'transfer-encoding': 'chunked', "etag": "d4843947f74305a3747dfcc0d25a38fe"}, "<h1>test</h1>",
		function(serverResponse) {
			proxymodule.process_response(request, clientResponse, serverResponse);
		});
}

exports["A request containing an etag, received for content whose etag hasn't changed, should be served a 304 instead of requested content."] = function () {
	var proxymodule = mixin.mix('./src/proxy.js', {});

	var request = {url: "/test10", host: "test.com", Etag: "d4843947f74305a3747dfcc0d25a38fe"};
	var clientResponse = {statusCode: 200, body: "<h1>test</h1>", headers: {"Content-Type": "text/html"}};

	fakeResponseStream(304, {"Content-Type": "text/plain", }, "Not modified",
		function(serverResponse) {
			proxymodule.process_response(request, clientResponse, serverResponse);
		});
}

exports["All requests should be forwarded to the configured server."] = function() {
	require('server').configure({targetServer: "test.com", targetPort: 80});

	var request = {url: "/test10", host: "google.com", Etag: "d4843947f74305a3747dfcc0d25a38fe", method: "GET", headers: {name: "val"}};

	ducky.mock({})
		.expect("request").withArgs("GET", "/test10", request.headers).andReturn("proxy_response")
		.playback(function(clientConnection) {
			ducky.mock(proxymodule.http)
				.expect("createClient").withArgs(80, "test.com").andReturn(clientConnection)
				.playback(function (http) {
					assert.equal("proxy_response", proxymodule.openConnectionToTargetServer(request));
				});
		});
}

var didIgnoreTests = false;
for(var key in ignoredTests) {
	didIgnoreTests = true;
}

if(didIgnoreTests) {
	sys.puts('*******************************************');
	sys.puts("The following tests have been ignored: ");
	for(var key in ignoredTests) {
		sys.puts('* ' + key);
	}
	sys.puts('*******************************************');
}
