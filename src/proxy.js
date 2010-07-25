var sys = require("sys");
var http = require("http");
var server = require("server");
var minifier = require("minifier");
var Cache = require("cache").Cache;
var cache = new Cache();
var Buffer = require("buffer").Buffer;

exports.proxy_request_handler = function (request, response) {
	console.log("http://" + request.headers["host"] + " -- " + request.url);

	var proxy = http.createClient(80, request.headers["host"]);
	var proxy_request = proxy.request(request.method, request.url, request.headers);

	var strategyIfCached = cached_response;
	var strategyIfNotCached = function () {
		proxy_request.on("response", function (proxy_response) {
			var bufferSize = 64 * 1024;
			var bufferPos = 0;
			var buffer = new Buffer(bufferSize);
			
			proxy_response.setEncoding("binary");

			proxy_response.on("data", function(chunk) {
				var bufferNextPos = bufferPos + chunk.length;
				if(bufferNextPos > bufferSize) {
					sys.puts("Current buffer size: " + bufferSize);
					bufferSize = (Math.ceil(bufferNextPos / (64*1024)) + 1) * 64 * 1024;	// Add units of 64 KiB to accomodate the chunk
					sys.puts("Buffer size bumped up to : " + bufferSize)
					var tempBufferValue = buffer.toString("binary", 0, bufferPos);
					buffer = new Buffer(bufferSize);
					buffer.write(tempBufferValue, "binary");
				}
				buffer.write(chunk, "binary", bufferPos);
				bufferPos += chunk.length;
			});
			proxy_response.on("end", function() {
				proxy_response.body = buffer.toString("binary", 0, bufferPos);
				process_response(request, proxy_response, response);
			});
		});

		request.on("data", function(chunk) {
			proxy_request.write(chunk, "binary");
		});
		request.on("end", function() {
			proxy_request.end();
		});
	};

	process_request(request, response, strategyIfCached, strategyIfNotCached);
}

function cached_response (request, response) {
	console.log("Delivered from cache: " + request.host + " -- " + request.url)
	response.writeHead(200, {"Content-Type": "text/html"});
	response.write(cache.get(request), "binary");
	response.end();
};

var transformContent = function (type, content) {
	type = type.toLowerCase().split(";")[0]; // Content type could include encoding, seperated by a ";"
	
	var transformers = {
		"text/html": function (html) {
			return minifier.minify(html);
		}
	};
	
	if (transformers[type]) {
		return transformers[type](content);
	}
	
	return content;
}

function findValue(headers, name) {
	name = name.toLowerCase();
	
	for(var header in headers) {
		if (header.toLowerCase() == name) {
			return headers[header];
		}
	}
	
	throw "Couldn't find header";
}

function process_response(request, clientResponse, serverResponse) {
	serverResponse.writeHead(clientResponse.statusCode, clientResponse.headers);
	var content = transformContent(findValue(clientResponse.headers, "content-type"), clientResponse.body);
	cache.add(request, content);
	serverResponse.write(content, "binary");
	serverResponse.end();
}

function process_request(request, response, ifCached, ifNotCached) {
	if(cache.has(request)) {
		ifCached(request, response);
	} else {
		ifNotCached(request, response);
	}
}
