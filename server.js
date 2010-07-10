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
		return req.verb + ',' + req.url;
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

function requestprocessor(req, res) {
	var fileresource = "." + req.url;
	sys.log(req.url);

	var withErrorHandling = handleFileErrors(req, res);

	if(cache.has(req)) {
		writeHTML(res, cache.get(req));
	}
	else {
		fs.stat(fileresource, withErrorHandling(function(stats) {
			if(stats.isFile()) {
				fs.readFile(fileresource, "utf-8", withErrorHandling(function (data) {
					writeHTML(res, data);
				}));
			}
			else if (stats.isDirectory()) {
				fs.readdir(fileresource, withErrorHandling(function(files) {
					var result = "";

					for(var i in files) {
						var httpresource = req.url;
						result = "<a href=\"" + httpresource;
						if(!httpresource.endsWith("/")) result += "/";
						result += files[i] + "\">" + files[i] + "</a>";
					}

					writeHTML(res, result);
				}));
			}
		}));
	}
}

var startServer = exports.startServer = function(ip, port) {
	http.createServer(requestprocessor).listen(port, ip);
}

exports.defaultLocalServer = function () {
	startServer('127.0.0.1', 8080);
}
