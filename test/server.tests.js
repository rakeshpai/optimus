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

var fakeFileSystem = actlikeaduck.stub({})
		.expect("stat").withArgs("./test.html", function () {}).executeCallback(1, undefined,
																actlikeaduck.stub({})
																	.expect("isDirectory").andReturn(false)
																	.expect("isFile").andReturn(true)
																	.stubbedObj)
		.expect("stat").withArgs("./hello/world.html", function () {}).executeCallback(1, undefined,
																actlikeaduck.stub({})
																	.expect("isDirectory").andReturn(false)
																	.expect("isFile").andReturn(true)
																	.stubbedObj)
		.expect("stat").withArgs("./hello/", function () {}).executeCallback(1, undefined,
																actlikeaduck.stub({})
																	.expect("isDirectory").andReturn(true)
																	.expect("isFile").andReturn(false)
																	.stubbedObj)
		.expect("stat").withArgs("./hello", function () {}).executeCallback(1, undefined,
																actlikeaduck.stub({})
																	.expect("isDirectory").andReturn(true)
																	.expect("isFile").andReturn(false)
																	.stubbedObj)
		.expect("stat").withUnexpectedArgs().executeCallback(1, new fileSystemErrorMessage("file not found"), undefined)
		.expect("readFile").withArgs("./test.html", "utf-8", function() {}).executeCallback(2, undefined, "test data")
		.expect("readFile").withArgs("./hello/world.html", "utf-8", function() {}).executeCallback(2, undefined, "hi")
		.expect("readFile").withUnexpectedArgs().executeCallback(2, undefined, new fileSystemErrorMessage("file not found"))
		.expect("readdir").withArgs("./hello", function() {}).executeCallback(1, undefined, ["world.html"])
		.expect("readdir").withArgs("./hello/", function() {}).executeCallback(1, undefined, ["world.html"])
		.stubbedObj;

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

function callOnce(fn) {
	var timesItHappened = 0;

	return function () {
		fn.apply(null, arguments);
		timesItHappened ++; assert.equal(1, timesItHappened);
	};

	assert.equal(1, timesItHappened);
}
