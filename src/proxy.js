var sys = require('sys');
var http = require('http');
var server = require('server');
var minifier = require('minifier');
var Cache = require('cache').Cache;
var hash = require('hash');

var cache = new Cache();

var Buffer = require("buffer").Buffer;

function openConnectionToTargetServer(request) {
	return http.createClient(server.getSettings().targetPort, server.getSettings().targetServer).request(request.method, request.url, request.headers);
}

function forwardToTargetServer(request, responseHandler) {
	var proxy_request = openConnectionToTargetServer(request);

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
			responseHandler(proxy_response);
		});
	});

	request.on("data", function(chunk) {
		proxy_request.write(chunk, "binary");
	});
	request.on("end", function() {
		proxy_request.end();
	});
}

exports.proxy_request_handler = function (request, response) {
	console.log("http://" + request.headers["host"] + " -- " + request.url);
	
	forwardToTargetServer(request, function (target_server_response) {
		proxy_response(request, target_server_response, response);
	})
}

function cached_response (request, response) {
	console.log("Delivered from cache: " + request.host + " -- " + request.url)
	response.writeHead(200, {"Content-Type": "text/html"});
	response.write(cache.getBody(request), "binary");
	response.end();
};

var transformContent = function (type, content) {
	type = type.toLowerCase().split(";")[0]; // Content type could include encoding, seperated by a ";"
	
	var transformers = {
		"text/html": function (html) {
			var settings = server.getSettings();
			if(settings.enableHtmlMinification) {
				var startTime = new Date();
				var minified = minifier.minify(html, server.getSettings().htmlMinifier);
				sys.puts("Time taken to minify: " + (new Date() - startTime) + "ms. Savings: " + ((html.length-minified.length) * 100/html.length).toFixed(2) + "%");
				return minified;
			} else {
				return html;
			}
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
	
	return "";
}

function prepareResponseHeaders(headers) {
	var newHeaders = {}, headersToDrop = ["etag", "last-modified", "accept-ranges", "content-length", "connection"]
	for (var key in headers) {
		if(headersToDrop.indexOf(key) === -1){
			newHeaders[key] = headers[key];
		}
	}
	
	newHeaders["transfer-encoding"] = "chunked";
	
	return newHeaders;
}

function process_response(request, clientResponse, serverResponse) {
	var responseBody = clientResponse.body;
	var responseHash = hash.hashOf(responseBody);
	var contentType = findValue(clientResponse.headers, "content-type");
	
	if(responseHash == findValue(request, "etag")) {
		serverResponse.writeHead(304, {"Content-Type": "text/plain"});
		serverResponse.write("Not modified", "binary");
	} else {
		var headers = prepareResponseHeaders(clientResponse.headers)

		headers.etag = responseHash;
		
		serverResponse.writeHead(clientResponse.statusCode, headers);
		
		if(cache.has(responseHash)) {
			console.log("Responding with data from cache");
			serverResponse.write(cache.get(responseHash), "binary");
		} else {
			console.log("Responding with data transformed");
			var transformedContent = transformContent(contentType, responseBody)
			serverResponse.write(transformedContent, "binary");
			cache.set(responseHash, transformedContent);
		}
	}
	
	serverResponse.end();
}