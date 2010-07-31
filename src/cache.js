function Cache() {
}

(function () {
	var cache = {};
	
	Cache.prototype = {
		has: function(key) {
			return cache.hasOwnProperty(key);
		},

		set: function(key, value) {
			cache[key] = value;
		},

		get: function(key) {
			return cache[key];
		}
	};
})();

exports.Cache = Cache;
