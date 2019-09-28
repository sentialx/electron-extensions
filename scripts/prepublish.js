const { copyFileSync } = require('fs');

copyFileSync('./package.json', './build/package.json');
