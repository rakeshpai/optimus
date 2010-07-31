var fs = require('fs');
var sys = require('sys');
var assert = require('assert');

var actlikeaduck = require('actlikeaduck');

require.paths.unshift("./src");
require.paths.unshift("./lib");

var mixin = require('mixin');

function fileSystemErrorMessage(path) {
	return {
		message: "ENOENT, No such file or directory '" + path + "'",
		errno: 2,
		path: path,
		name: "Error"
	};
}

var fakeFileSystem = {
	stat: function(name, callback) {
		if(name == "./test.html" ||
		   name == "./hello/world.html") {
			callback(undefined, { isDirectory: function () { return true; }, isFile: function () { return true; }});
		}
		else if (name == "./hello" ||
		         name == "./hello/") {
			callback(undefined, { isDirectory: function () { return true; }, isFile: function () { return false; }});
		}
		else {
			callback(new fileSystemErrorMessage(name), undefined);
		}
	},

	readFile: function(path) {
		var callback = arguments[1];

		if(arguments.length == 3)
			callback = arguments[2];

		if(path == "./test.html")
			callback(undefined, "test data");
		else if (path == "./hello/world.html")
			callback(undefined, "hi");
		else
			callback(new fakeFileSystem(path), undefined);
	},

	readdir: function(path, callback) {
		callback(undefined, ["world.html"]);
	}
};

var servermodule = mixin.mix("./src/server.js", {fs: fakeFileSystem});

function fakeResponseStream(expectedStatus, expectedHead, expectedBody, test) {
	actlikeaduck.mock({})
		.expect("writeHead").withArgs(expectedStatus, expectedHead)
		.expect("write").withArgs(expectedBody)
		.expect("end")
		.playback(test);
}

var htmlContentTypeResponseHeader = {"Content-Type": "text/html"};

function requestForUrl(url) {
	return {url: url, method: "GET"};
}

var testRequest = (function (context) {
	return function(url, status, headers, response) {
		fakeResponseStream(status, headers, response,
			function(responseStream) {
				context.requestProcessor(requestForUrl(url), responseStream);
			});
	};
})(servermodule);

var testRequestForHTMLUrl = (function (context) {
	return function(url, response) {
		testRequest(url, 200, htmlContentTypeResponseHeader, response);
	};
})(servermodule);

exports['When requested for a file named /test.html the response should be \'test data\''] = function () {
	testRequestForHTMLUrl("/test.html", "test data");
};

exports['When requested for an html file named /hello/world.html the response should be \'hi\''] = function () {
	testRequestForHTMLUrl("/hello/world.html", "hi");
};

exports['When requested for /hello/ the response should be a listing of this directory.'] = function () {
	testRequestForHTMLUrl("/hello/", "<a href=\"/hello/world.html\">world.html</a>");
};

exports['When requested for /hello (without the trailing slash) the response should be a listing of this directory.'] = function () {
	testRequestForHTMLUrl("/hello", "<a href=\"/hello/world.html\">world.html</a>");
};

exports['If a requested file does not exist, the response should be a 404.'] = function () {
	testRequest("/file-does-not-exist.html", 404, {"Content-Type": "text/plain"}, "/file-does-not-exist.html - File not found");
};

exports['If requested for a cached url, the cached response should be returned.'] = function () {
	var cache = new servermodule.Cache();
	var req = requestForUrl("/test.html");

	cache.addBody(req, "test cached data");

	assert.ok(cache.has(req));
	assert.equal("test cached data", cache.getBody(req));
};

function callOnce(fn) {
	var timesItHappened = 0;

	return function () {
		fn.apply(null, arguments);
		timesItHappened ++; assert.equal(1, timesItHappened);
	};

	assert.equal(1, timesItHappened);
}

exports['When a request for an uncached url is received, it should be cached immediately. After that, the cached response should be returned.'] = function () {
	var nextHandler = callOnce(function(req, res) { servermodule.cache.addBody(req, "cached data"); });

	fakeResponseStream(200, htmlContentTypeResponseHeader, "cached data",
		function(responseStream) {
			for(var i = 0; i < 2; i ++) {
				servermodule.cachingRequestProcessor(requestForUrl("cached-data.html"), responseStream, nextHandler);
			}
		});

	fakeResponseStream(200, htmlContentTypeResponseHeader, "test data",
		function(responseStream) {
			servermodule.fileSystemRequestProcessor(requestForUrl("/test.html"), responseStream);
		});

	assert.ok(servermodule.cache.has(requestForUrl("/test.html")), "The response to a request for /test.html should be cached if it is seen for the first time.");
};
