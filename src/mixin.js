var fs = require('fs');
var sys = require('sys');
var Script = process.binding('evals').Script;

exports['mix'] = function (filename, context) {
  var data = fs.readFileSync(filename)
  context['require'] = require;
  context['exports'] = exports;
  for(var key in global) { context[key] = global[key]; }
  Script.runInNewContext(data, context, filename);

  return context;
};
