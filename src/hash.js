var crypto = require('crypto');

exports.hashOf = function(content) {
	var hash = crypto.createHash('md5');
	hash.update(content);
	return hash.digest('hex');
}