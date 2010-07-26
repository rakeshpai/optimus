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

		addBody: function(req, value) {
			cache[cacheKey(req)] = value;
		},

		getBody: function(req) {
			return cache[cacheKey(req)];
		}
	};
})();

exports.Cache = Cache;
