var mixin = require('./mixin');

var minifier = mixin.mix('./minifier/htmlparser.js', {});
minifier = mixin.mix('./minifier/htmllint.js', minifier);
minifier = mixin.mix('./minifier/htmlminifier.js', minifier);

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

exports.minify = function (html) { return minifier.minify(html, options); };
