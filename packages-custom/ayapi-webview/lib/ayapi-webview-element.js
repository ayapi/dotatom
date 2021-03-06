'use babel';
import path from 'path';
import { EventsDelegation, DisposableEvents } from 'atom-utils';
import { CompositeDisposable, Disposable, Emitter } from 'atom';
import chromeNetworkErrors from 'chrome-network-errors';
import AyapiWebviewFindInPageElement from './ayapi-webview-find-in-page-element';

class AyapiWebviewElement extends HTMLElement {
  initialize(state) {
    this._title = 'webview';
    this.uri = state.uri;
    this.setFindInPageElement(state.findInPage);
    
    this.ready = false;
    this.zoom = 0;
  }
  
  createdCallback() {
    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();
    
    this.classList.add('ayapi-webview');
    this.setAttribute('tabindex', '-1');
    
    this.subscriptions.add(
      atom.workspace.onDidChangeActivePaneItem((item) => {
        if (item == this) {
          if (this.style.visibility == 'visible') {
            return;
          }
          this.style.visibility = 'visible';
          this.focus();
          return;
        }
        let paneForActivatedItem = atom.workspace.paneForItem(item);
        let paneForThis = atom.workspace.paneForItem(this);
        if (paneForActivatedItem == paneForThis) {
          this.style.visibility = 'hidden';
          this.style.display = null;
        }
      })
    );
    
    this.createWebviewElement();
  }
  
  createWebviewElement() {
    let webview = document.createElement('webview');
    let webviewEvents = {};
    [
      'load-commit', 'dom-ready', 'did-finish-load', 'did-fail-load',
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
    
    this.subscriptions.add(
      this.addDisposableEventListener(this, 'focus', ev => webview.focus())
    );
    
    this.subscriptions.add(
      atom.commands.add(webview, {
        'ayapi-webview:reload': this.reload.bind(this),
        'ayapi-webview:backward-history': this.backwardHistory.bind(this),
        'ayapi-webview:forward-history': this.forwardHistory.bind(this),
        'ayapi-webview:zoom-in': this.zoomIn.bind(this),
        'ayapi-webview:zoom-out': this.zoomOut.bind(this),
        'ayapi-webview:toggle-dev-tools': this.toggleDevTools.bind(this),
        'ayapi-webview:find-in-page': this.showFindView.bind(this)
      })
    );
    
    let readyCallback = function() {
      this.ready = true;
      this.emitter.off('dom-ready', readyCallback);
    }.bind(this);
    this.emitter.on('dom-ready', readyCallback);
    
    this.subscriptionForInitialLoad = null;
    
    this.emitter.on('page-title-updated', (ev) => {
      this._title = ev.title;
      this.emitter.emit('did-change-title', ev.title);
    });
    
    this.emitter.on('load-commit', ({url, isMainFrame}) => {
      if (!isMainFrame) return;
      this.zoom = 0;
      webview.insertCSS(`html{ background:#fff }`);
    });
    
    webview.setAttribute('src', 'about:blank');
    webview.setAttribute('partition', 'persist:atom-ayapi-webview');
    webview.setAttribute('preload', path.join(__dirname, 'preload.js'));
    
    const container = document.createElement('div');
    container.classList.add('ayapi-webview-container');
    container.classList.add('native-key-bindings');
    container.appendChild(webview);
    this.appendChild(container);
    
    this.webview = webview;
  }
  
  attachedCallback() {
    if (this.style.display == 'none') {
      this.style.visibility = 'hidden';
      this.style.display = null;
    } else {
      this.style.visibility = 'visible';
      this.style.display = null;
    }
  }
  
  setModel(model) {
    this.model = model;
    
    this.emitter.on('load-commit', (ev) => {
      let {url, isMainFrame} = ev;
      if (isMainFrame) {
        this.model.address = url;
      }
    });
    
    this.emitter.on('did-navigate-in-page', (ev) => {
      this.model.address = ev.url;
    });
    
    this.emitter.on('did-get-redirect-request', (ev) => {
      let {newURL, isMainFrame} = ev;
      if (isMainFrame) {
        this.model.address = newURL;
      }
    });
    
    this.emitter.on('did-fail-load', (ev) => {
      if (!ev.isMainFrame || ev.errorCode == -3) {
        return;
      }
      let q = {
        errorCode: ev.errorCode,
        errorName: chromeNetworkErrors[ev.errorCode],
        url: ev.validatedURL,
        type: 'loading-failed'
      };
      this.webview.send('err', q);
    });
    
    if (model.address) {
      this.loadURL(model.address);
    }
  }
  
  setFindInPageElement(element) {
    let footer;
    if (!element) {
      footer = new AyapiWebviewFindInPageElement();
      footer.initialize({});
    } else {
      footer = element;
    }
    this.appendChild(footer);
    
    if (footer.visible) {
      footer.focus();
    }
    
    this.subscriptions.add(
      this.emitter.on('ipc-message', ({channel, args}) => {
        if (!channel.startsWith('find-in-page:')) {
          return;
        }
        switch (channel.split(':')[1]) {
          case 'found':
            let {current, total} = args[0];
            footer.current = current + 1;
            footer.total = total;
          break;
        }
      })
    );
    this.subscriptions.add(
      this.emitter.on('dom-ready', () => {
        footer.current = 0;
        footer.total = 0;
      })
    );
    this.emitter.on('load-commit', (ev) => {
      let {url, isMainFrame} = ev;
      if (isMainFrame) {
        footer.cancel();
      }
    });
    this.subscriptions.add(
      footer.onDidFindRequest((options) => {
        this.focus();
        this.webview.send('find', options);
      })
    );
    this.subscriptions.add(
      footer.onDidCancel(() => {
        this.focus();
        footer.hide();
        this.webview.send('clearFound');
      })
    );
    this.subscriptions.add(
      atom.commands.add(this.webview, {
        'ayapi-webview:find-next': (ev) => {
          if (footer.visible) {
            footer.find(1);
          } else {
            ev.abortKeyBinding();
          }
        },
        'ayapi-webview:find-prev': (ev) => {
          if (footer.visible) {
            footer.find(-1);
          } else {
            ev.abortKeyBinding();
          }
        },
        'core:cancel': (ev) => {
          if (footer.visible) {
            footer.cancel();
          } else {
            ev.abortKeyBinding();
          }
        }
      })
    );
    
    this.findInPageElement = footer;
  }
  
  loadURL(url) {
    if (this.subscriptionForInitialLoad) {
      this.subscriptionForInitialLoad.dispose();
    }
    if (this.ready) {
      this.webview.stop();
      this.webview.loadURL(url);
    } else {
      let readyCallback = function() {
        this.emitter.off('dom-ready', readyCallback);
        this.webview.stop();
        this.webview.loadURL(url);
      }.bind(this);
      this.emitter.on('dom-ready', readyCallback);
      this.subscriptionForInitialLoad = new Disposable(() => {
        this.emitter.off('dom-ready', readyCallback);
        this.subscriptionForInitialLoad = null;
      });
    }
  }
  
  reload() {
    this.webview.reloadIgnoringCache();
  }
  
  backwardHistory() {
    this.webview.goBack();
  }
  
  forwardHistory() {
    this.webview.goForward();
  }
  
  zoomIn() {
    this.zoom++;
    this.webview.setZoomLevel(this.zoom);
  }
  
  zoomOut() {
    this.zoom--;
    this.webview.setZoomLevel(this.zoom);
  }
  
  toggleDevTools() {
    if (this.webview.isDevToolsOpened()) {
      this.webview.closeDevTools();
    } else {
      this.webview.openDevTools();
    }
  }
  
  showFindView() {
    this.findInPageElement.show();
    this.findInPageElement.focus();
  }
  
  getURL() {
    try {
      return this.webview.getURL();
    } catch (e) {
      return this.model.address;
    }
  }
  
  onDomReady(callback) {
    return this.emitter.on('dom-ready', () => {
      callback(this.webview.getURL());
    });
  }
  
  onWillOpenNewWindow(callback) {
    return this.emitter.on('new-window', callback);
  }
  
  onDidChangeTitle(callback) {
    return this.emitter.on('did-change-title', callback);
  }
  
  getTitle() {
    return this._title;
  }
  
  getLongTitle() {
    return this.model ? this.model.address : this._title;
  }
  
  getURI() {
    return this.uri;
  }
  
  serialize() {
    return {
      deserializer: 'AyapiWebviewElement',
      uri: this.getURI(),
      findInPage: this.findInPageElement ? this.findInPageElement.serialize() : null
    }
  }
  
  destroy() {
    this.emitter.dispose();
    this.subscriptions.dispose();
    if (this.subscriptionForInitialLoad) {
      this.subscriptionForInitialLoad.dispose();
    }
    if (this.webview && this.ready) {
      try {
        this.webview.stop();
      } catch (err) {
        // ignore error
      }
    }
    this.webview = null;
    this.findInPageElement = null;
  }
}

EventsDelegation.includeInto(AyapiWebviewElement);

module.exports = AyapiWebviewElement = document.registerElement(
  'ayapi-webview',
  {prototype: AyapiWebviewElement.prototype}
)
