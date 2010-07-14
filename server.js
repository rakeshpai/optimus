var sys = require('sys');
var fs = require('fs');
var http = require('http');

var htmlContentHeaders = {"Content-Type": "text/html"};
var HTTP_STATUS_OK = 200;

String.prototype.endsWith = function(str) {return (this.match(str+"$")==str)}

function handleFileErrors(req, res) {
	return function (fn) {
		return function (err, data) {
			if (err) {
				sys.log("ERROR: " + err);

				res.writeHead(404, {"Content-Type": "text/plain"});
				res.write(req.url + " - File not found");
				res.end();
			}
			else {
				return fn(data);
			}
		};
	};
}

function Cache() {
}

(function () {
	var cache = {};
	
	function cacheKey(req) {
		return req.method + ',' + req.url;
	}
	
	Cache.prototype = {
		has: function(req) {
			return cache.hasOwnProperty(cacheKey(req));
		},

		add: function(req, value) {
			cache[cacheKey(req)] = value;
		},

		get: function(req) {
			return cache[cacheKey(req)];
		}
	};
})();

var cache = new Cache();

function writeHTML(res, content) {
	res.writeHead(HTTP_STATUS_OK, htmlContentHeaders);
	res.write(content);
	res.end();
}

function formatFileListAsHTML(urlpath, files) {
	var result = "";

	for(var i in files) {
		var httpresource = urlpath;
		result = "<a href=\"" + httpresource;
		if(!httpresource.endsWith("/")) result += "/";
		result += files[i] + "\">" + files[i] + "</a>";
	}

	return result;
}

function fileSystemRequestProcessor(req, res) {
	var fileresource = "." + req.url;

	var withErrorHandling = handleFileErrors(req, res);

	fs.stat(fileresource, withErrorHandling(function(stats) {
		if(stats.isFile()) {
			fs.readFile(fileresource, "utf-8", withErrorHandling(function (data) {
				cache.add(req, data);
				writeHTML(res, data);
			}));
		}
		else if (stats.isDirectory()) {
			fs.readdir(fileresource, withErrorHandling(function(files) {
				var content = formatFileListAsHTML(req.url, files);
				cache.add(req, content);
				writeHTML(res, content);
			}));
		}
	}));
}

function cachingRequestProcessor (req, res, nextHandler) {
	if(cache.has(req))
	{
		sys.log("Cached: " + req.method + " " + req.url)
		writeHTML(res, cache.get(req));
	}
	else
	{
		sys.log(req.url);
		nextHandler(req, res);
	}
}

function requestProcessor(req, res) {
	cachingRequestProcessor(req, res, fileSystemRequestProcessor);
}

var startServer = exports.startServer = function(ip, port) {
	http.createServer(requestProcessor).listen(port, ip);
}

exports.defaultLocalServer = function () {
	startServer('127.0.0.1', 8080);
}
