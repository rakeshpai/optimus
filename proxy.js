var http = require('http');
var server = require('./server');
var minifier = require('./minifier');

exports.proxy_request_handler = function (request, response) {
  console.log("http://" + request.headers['host'] + request.url);

  var proxy = http.createClient(80, request.headers['host'])
  var proxy_request = proxy.request(request.method, request.url, request.headers);
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
}

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
	serverResponse.writeHead(200, clientResponse.headers);
	serverResponse.write(transformContent(findValue(clientResponse.headers, "content-type"), clientResponse.body));
	serverResponse.end();
}
