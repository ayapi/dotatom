"use strict";

const {ipcRenderer} = require('electron');

ipcRenderer.once('err', (ev, {type, errorCode, errorName, description}) => {
  let msg = description;
  if (type === 'loading-failed') {
    msg = `${errorCode}(${errorName})`;
  }
  document.clear();
  document.write(`<html><head><title>${msg}</title></head><body>${msg}</body></html>`);
});