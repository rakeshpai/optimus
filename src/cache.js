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

exports.Cache = Cache;
