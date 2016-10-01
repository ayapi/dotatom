const babel = require('babel-core');
const fs = require('fs-plus');
const path = require('path');
const createRunner = require('atom-mocha-test-runner').createRunner;
const extraOptions = {
  globalAtom: true
};

function optionalConfigurationFunction(mocha) {
  // transpile spec files to enable 'babel-preset-power-assert'
  // because we can't use `babel-register` on this context
  mocha.files = mocha.files
    .map((file) => {
      return path.relative(__dirname, file);
    })
    .filter((file) => {
      return !(/^[./\\]/.test(file))
    })
    .map((file) => {
      let code = fs.readFileSync(file);
      let transformed = babel.transform(code, {
        plugins: [
          'babel-plugin-transform-es2015-modules-commonjs',
          'babel-plugin-transform-async-to-generator'
        ],
        presets: ['babel-preset-power-assert']
      });
      let pathObject = path.parse(file);
      delete pathObject.base;
      pathObject.name = pathObject.name + '-transformed';
      let transformedPath = path.format(pathObject);
      fs.writeFileSync(transformedPath, transformed.code, {encoding: 'utf8'});
      return path.resolve(transformedPath);
    });
  
  mocha.suite.on('pre-require', (global, file, self) => {
    delete require.cache[file];
  });  
  mocha.suite.on('post-require', (global, file, self) => {
    if (path.basename(file, '.js').endsWith('-transformed')) {
      fs.unlinkSync(file);
    }
  });
  
  // simulating 'apm link dev'
  // for use `atom.packages.activatePackage('package-name')` in specs
  let packageName = require('./package.json').name;
  let packagesDir = atom.packages.getPackageDirPaths().find((dir) => {
    return dir.endsWith(path.sep + path.join('dev', 'packages'));
  });
  try {
    fs.makeTreeSync(packagesDir);
    fs.symlinkSync(__dirname, path.join(packagesDir, packageName), 'junction');
  } catch (err) {
    console.log(err);
  }
}

module.exports = createRunner(extraOptions, optionalConfigurationFunction);
