var sys = require('sys');
var http = require('http');
var server = require('./server');
var minifier = require('./minifier');
var Cache = require('./cache').Cache;
var cache = new Cache();

exports.proxy_request_handler = function (request, response) {
  console.log("http://" + request.headers['host'] + ' -- ' + request.url);

  var proxy = http.createClient(80, request.headers['host']);
  var proxy_request = proxy.request(request.method, request.url, request.headers);

  var strategyIfCached = cached_response;
  var strategyIfNotCached = function () {
	  proxy_request.addListener('response', function (proxy_response) {
		var responseBody = "";

	    proxy_response.addListener('data', function(chunk) {
	      responseBody = responseBody + chunk;
	    });
	    proxy_response.addListener('end', function() {
		  proxy_response.body = responseBody;
	      process_response(request, proxy_response, response);
	    });
	  });

	  request.addListener('data', function(chunk) {
	    proxy_request.write(chunk, 'binary');
	  });
	  request.addListener('end', function() {
	    proxy_request.end();
	  });
  };

  process_request(request, response, strategyIfCached, strategyIfNotCached);
}

function cached_response (request, response) {
	console.log("Delivered from cache: " + request.host + " -- " + request.url)
	response.writeHead(200, {"Content-Type": "text/html"});
	response.write(cache.get(request));
	response.end();
};

var transformContent = function (type, content) {
	type = type.toLowerCase();
	
	var transformers = {
		"text/html": function (html) {
			return minifier.minify(html);
		}
	};
	
	if (transformers[type])
			return transformers[type](content);
	
	return content;
}

function findValue(headers, name) {
	name = name.toLowerCase();
	
	for(var header in headers) {
		if (header.toLowerCase() == name)
			return headers[header];
	}
	
	throw "Couldn't find header";
}

function process_response(request, clientResponse, serverResponse) {
	serverResponse.writeHead(clientResponse.statusCode, clientResponse.headers);
	var content = transformContent(findValue(clientResponse.headers, "content-type"), clientResponse.body);
	cache.add(request, content);
	serverResponse.write(content);
	serverResponse.end();
}

function process_request(request, response, ifCached, ifNotCached) {
	if(cache.has(request))
		ifCached(request, response);
	else
		ifNotCached(request, response);
}
