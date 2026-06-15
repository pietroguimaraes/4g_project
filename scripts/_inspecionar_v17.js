var fs = require('fs');
var d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_victor_pizza_v17.json', 'utf8'));
var hr6 = d.nodes.find(function(n) { return n.name === 'HTTP Request6'; });
if (!hr6) {
  console.log('HTTP Request6 nao encontrado. Nodes:');
  d.nodes.forEach(function(n) { console.log(' -', n.name, '|', n.type); });
} else {
  console.log('=== HTTP Request6 parameters ===');
  console.log(JSON.stringify(hr6.parameters, null, 2));
}
