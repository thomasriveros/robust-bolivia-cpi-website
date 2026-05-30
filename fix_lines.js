const fs = require('fs');
let data = fs.readFileSync('src/App.tsx', 'utf8');
data = data.split('\n').map(line => {
  if (line.includes('<Line ') && line.includes('dot={false}')) {
    return line.replace('dot={false}', 'dot={ForwardFillDot}');
  }
  return line;
}).join('\n');
fs.writeFileSync('src/App.tsx', data);
