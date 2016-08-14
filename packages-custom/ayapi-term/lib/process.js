'use babel';
const pty = require('ptyw.js');
const path = require('path');
const fs = require('fs');
const child = require('child_process');

module.exports = function(pwd, shell, args, options) {
  let callback, emitTitle, ptyProcess, title;
  options = options || {};
  callback = this.async();
  if (/zsh|bash/.test(shell) && args.indexOf('--login') === -1) {
    args.unshift('--login');
  }
  ptyProcess = pty.fork(shell, args, {
    cwd: pwd,
    env: process.env,
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows
  });
  title = shell = path.basename(shell);
  // emitTitle = _.throttle(function() {
  //   return emit('ayapi-term:title', ptyProcess.process);
  // }, 500, true);
  ptyProcess.on('data', function(data) {
    emit('ayapi-term:data', data);
    // return emitTitle();
  });
  ptyProcess.on('exit', function() {
    emit('ayapi-term:exit');
    return callback();
  });
  return process.on('message', function(args) {
    args = args || {};
    let {event, rows, cols, text} = args;
    switch (event) {
      case 'resize':
        return ptyProcess.resize(cols, rows);
      case 'input':
        return ptyProcess.write(text);
    }
  });
};