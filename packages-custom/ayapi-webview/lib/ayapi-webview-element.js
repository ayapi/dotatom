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
    
    webview.setAttribute('src', 'about:blank');
    webview.setAttribute('partition', 'persist:atom-ayapi-webview');
    webview.setAttribute('preload', path.join(__dirname, 'preload.js'));
    this.appendChild(webview);
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
    if (!element) {
      this.findInPageElement = new AyapiWebviewFindInPageElement();
      this.findInPageElement.initialize({});
    } else {
      this.findInPageElement = element;
    }
    this.appendChild(this.findInPageElement);
    
    if (this.findInPageElement.visible) {
      this.findInPageElement.focus();
    }
    
    this.subscriptions.add(
      this.emitter.on('ipc-message', ({channel, args}) => {
        if (channel !== 'found') {
          return;
        }
        let {current, total} = args[0];
        this.findInPageElement.current = current;
        this.findInPageElement.total = total;
      })
    );
    this.subscriptions.add(
      this.emitter.on('dom-ready', () => {
        this.findInPageElement.current = 0;
        this.findInPageElement.total = 0;
      })
    );
    this.subscriptions.add(
      this.findInPageElement.onDidFindRequest((options) => {
        this.webview.send('find', options);
      })
    );
    this.subscriptions.add(
      this.findInPageElement.onDidCancel(() => {
        this.focus();
        this.findInPageElement.hide();
        this.webview.send('clearFound');
      })
    );
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