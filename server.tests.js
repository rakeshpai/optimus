var fs = require('fs');
var sys = require('sys');
var assert = require('assert');

var mixin = require('./mixin');

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

var servermodule = mixin.mix("./server.js", {fs: fakeFileSystem});

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

	assert.equal(1, timesItHappened);

	servermodule.fileSystemRequestProcessor(requestForUrl("/test.html"), fakeResponseStream(200, htmlContentTypeResponseHeader, "test data"));
	assert.ok(servermodule.cache.has(requestForUrl("/test.html")));
})();
