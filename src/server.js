var sys = require('sys');
var fs = fs || require('fs');
var http = require('http');
var Cache = require('cache').Cache;

var htmlContentHeaders = {"Content-Type": "text/html"};
var HTTP_STATUS_OK = 200;

String.prototype.endsWith = function(str) {return (this.match(str+"$")==str)}

function toS(obj) {
	var data = "";
	
	for(key in obj) {
		if (data.length > 0) data += "; ";
		data += key + '=' + obj[key];
	}
	
	return data;
}

function handleFileErrors(req, res) {
	return function (fn) {
		return function (err, data) {
			if (err) {
				sys.log("ERROR: " + toS(err));

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
				cache.addBody(req, data);
				writeHTML(res, data);
			}));
		}
		else if (stats.isDirectory()) {
			fs.readdir(fileresource, withErrorHandling(function(files) {
				var content = formatFileListAsHTML(req.url, files);
				cache.addBody(req, content);
				writeHTML(res, content);
			}));
		}
	}));
}

function cachingRequestProcessor (req, res, nextHandler) {
	if(cache.has(req))
	{
		sys.log("Cached: " + req.method + " " + req.url)
		writeHTML(res, cache.getBody(req));
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
	http.createServer(require('./proxy').proxy_request_handler).listen(port, ip);
	console.log("Started http server on " + ip + ":" + port)
};

var customSettings = null;

var defaultSettings = {
	proxy: {
		ip: "127.0.0.1",
		port: "8080"
	},
	
	enableHtmlMinification: true,
	
	htmlMinifier: {
		removeComments: true,
		removeCommentsFromCDATA: true,
		removeCDATASectionsFromCDATA: true,
		collapseWhitespace: false,
		collapseBooleanAttributes: true,
		removeAttributeQuotes: true,
		removeRedundantAttributes: true,
		useShortDoctype: true,
		removeEmptyAttributes: true,
		removeEmptyElements: false,
		removeOptionalTags: true,
		removeScriptTypeAttributes: true
	}
};

exports.configure = function (conf) {
	for(var key in conf) {
		getSettings()[key] = conf[key];
	}
}

var getSettings = exports.getSettings = function() {
	if(!customSettings) {
		customSettings = {};

		try {
			var data = fs.readFileSync(process.argv[2] || "./settings.json");
			try {
				customSettings = JSON.parse(data.toString("utf-8", 0, data.length));
			} catch(e) {
				sys.puts("Error parsing settings.json: " + e);
				process.exit(1);
			}
		} catch(e) {
			sys.puts("No settings.json found. Using default settings.");
		}

		customSettings.__proto__ = defaultSettings;
	}
	
	return customSettings;
};

exports.defaultLocalServer = function () {
	var settings = exports.getSettings();
	startServer(settings.proxy.ip, settings.proxy.port);
};
