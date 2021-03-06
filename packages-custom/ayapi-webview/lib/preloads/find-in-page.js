"use strict";

const {ipcRenderer} = require('electron');
const FindInPage = require('mitzkal');

document.addEventListener('DOMContentLoaded', function(event) {
  if (location.protocol == 'about:') {
    return;
  }
  
  const findInPage = new FindInPage();
  findInPage.on('did-find', (state) => {
    ipcRenderer.sendToHost('find-in-page:found', state);
  });
  ipcRenderer.on('find', (ev, options) => {
    findInPage.find(options);
  });
  ipcRenderer.on('clearFound', () => {
    findInPage.clear();
  });
});
