// Allow angular using electron module (native node modules)
const fs = require('fs');
const f_angular = 'node_modules/@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser.js';
const f_ifpsd_ctl = 'node_modules/ipfsd-ctl/src/utils/find-ipfs-executable.js';

fs.readFile(f_angular, 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  var result = data.replace(/target: "electron-renderer",/g, '');
  var result = result.replace(/target: "web",/g, '');
  var result = result.replace(/return \{/g, 'return {target: "electron-renderer",');

  fs.writeFile(f_angular, result, 'utf8', function (err) {
    if (err) return console.log(err);
  });
});

fs.readFile(f_ifpsd_ctl, 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  if (!data.includes('js-ipfs-dep')) {
    var result = data.replace(/js: path.join\('ipfs', 'src', 'cli', 'bin.js'\)/, "js: path.join('ipfs', 'src', 'cli', 'bin.js'), \n    jsdep: path.join('js-ipfs-dep', 'pkg', isWindows ? 'js-ipfs-dep.exe' : 'js-ipfs-dep')");
    fs.writeFile(f_ifpsd_ctl, result, 'utf8', function (err) {
      if (err) return console.log(err);
    });
  }
});
