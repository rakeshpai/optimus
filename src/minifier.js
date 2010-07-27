var mixin = require('mixin');

var minifier = mixin.mix('./lib/minifier/htmlparser.js', {});
minifier = mixin.mix('./lib/minifier/htmllint.js', minifier);
minifier = mixin.mix('./lib/minifier/htmlminifier.js', minifier);

var options = {
	removeEmptyElements: true,
	removeOptionalTags: true,
	removeCommentsFromCDATA: true,
	removeCDATASectionsFromCDATA: true,
	collapseWhitespace: true,
	removeComments: true,
	useShortDoctype: true,
	removeRedundantAttributes: true,
	removeScriptTypeAttributes: true,
	removeAttributeQuotes: true,
	removeEmptyAttributes: true,
	collapseBooleanAttributes: true
}

exports.minify = function (html) {
	try {
		return minifier.minify(html, options);
	}
	catch(e) {
		console.log("ERROR while minifying: " + e.toString());
	}
	
	return html;
};
