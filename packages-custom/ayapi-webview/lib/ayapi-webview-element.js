'use babel';
import { EventsDelegation } from 'atom-utils';
import { CompositeDisposable, Emitter } from 'atom';

class AyapiWebviewElement extends HTMLElement {
  initialize(state) {
    this.uri = state.uri;
    this.title = 'webview';
    
    this.ready = false;
  }
  
  createdCallback() {
    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();
    
    this.classList.add('ayapi-webview');
    this.setAttribute('tabindex', '-1');
    
    let webview = document.createElement('webview');
    let webviewEvents = {};
    [
      'dom-ready', 'did-finish-load', 'did-fail-load',
      'did-start-loading', 'did-stop-loading',
      'page-title-updated', 'new-window', 'did-get-redirect-request',
      'will-navigate', 'did-navigate', 'close', 'ipc-message',
      'crashed', 'gpu-crashed', 'plugin-crashed'
    ].forEach((name) => {
      webviewEvents[name] = (ev) => {
        this.emitter.emit(name, ev);
      };
    });
    this.subscriptions.add(this.subscribeTo(webview, webviewEvents));
    
    let readyCallback = function() {
      this.ready = true;
      this.emitter.off('dom-ready', readyCallback);
    }.bind(this);
    this.emitter.on('dom-ready', readyCallback);
    
    this.emitter.on('page-title-updated', (ev) => {
      this.title = ev.title;
      this.emitter.emit('did-change-title', ev.title);
    });
    
    webview.setAttribute('src', 'about:blank');
    this.appendChild(webview);
    this.webview = webview;
  }
  
  setModel(model) {
    this.model = model;
    
    this.emitter.on('will-navigate', (ev) => {
      this.model.address = ev.url;
    });
    
    this.emitter.on('did-get-redirect-request', (ev) => {
      let {newURL, isMainFrame} = ev;
      if (isMainFrame) {
        this.model.address = newURL;
      }
    });
    
    if (model.address) {
      this.loadURL(model.address);
    }
  }
  
  loadURL(url) {
    if (this.ready) {
      this.webview.loadURL(url);
    } else {
      let readyCallback = function() {
        this.emitter.off('dom-ready', readyCallback);
        this.webview.loadURL(url);
      }.bind(this);
      this.emitter.on('dom-ready', readyCallback);
    }
  }
  
  getURL() {
    return this.model.address;
  }
  
  onDidChangeTitle(callback) {
    return this.emitter.on('did-change-title', callback);
  }
  
  getTitle() {
    return this.title;
  }
  
  getLongTitle() {
    return this.model ? this.model.address : this.title;
  }
  
  getURI() {
    return this.uri;
  }
  
  serialize() {
    return {
      deserializer: 'AyapiWebviewElement',
      uri: this.getURI()
    }
  }
  
  destroy() {
    this.emitter.dispose();
    this.subscriptions.dispose();
  }
}

EventsDelegation.includeInto(AyapiWebviewElement);

module.exports = AyapiWebviewElement = document.registerElement(
  'ayapi-webview',
  {prototype: AyapiWebviewElement.prototype}
)