'use babel';

import url from 'url';
import { isWebUri } from 'valid-url';
import openInDefaultBrowser from 'open';
import AyapiWebview from './ayapi-webview';
import AyapiWebviewElement from './ayapi-webview-element';
import AyapiWebviewFindInPageElement from './ayapi-webview-find-in-page-element';
import { CompositeDisposable } from 'atom';
import { remote } from 'electron';

export default {

  views: new Map(),
  models: [],
  subscriptions: null,
  panel: null,
  editor: null,
  session: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ayapi-webview:input-address': () => this.showAddressEditor()
    }));

    this.subscriptions.add(
      atom.workspace.addOpener((uri) => {
        let {protocol} = url.parse(uri);
        if (!/^(ayapi-webview|http)/.test(uri)) {
          return;
        }
        
        let options;
        if (protocol === 'ayapi-webview:') {
          options = {uri: uri};
        } else if (protocol.startsWith('http')) {
          options = {
            uri: this.generateURI(),
            address: uri
          };
        }
        let model = new AyapiWebview(options);
        this.models.push(model);
        let view = atom.views.getView(model);
        this.bindViewEvents(view);
        return view;
      })
    );
    
    if (state && state.models) {
      state.models.forEach((s) => {
        let model = atom.deserializers.deserialize(s);
        let view = this.views.get(model.uri);
        if (view) {
          this.models.push(model);
          view.setModel(model);
          this.bindViewEvents(view);
        }
      });
    }
    
    let editor = atom.workspace.buildTextEditor({
      mini: true,
      lineNumberGutterVisible: false,
      placeholderText: 'http://',
      softWrapped: false
    });
    this.editor = editor;
    
    let editorElement = atom.views.getView(editor);
    editorElement.classList.add('ayapi-webview-address');
    editorElement.addEventListener('keydown', (ev) => {
      switch (ev.key) {
        case 'Escape':
          atom.commands.dispatch(editorElement, 'core:cancel');
          break;
      }
    });
    editorElement.addEventListener('blur', (ev) => {
      atom.commands.dispatch(editorElement, 'core:cancel');
    });
    
    this.subscriptions.add(
      atom.commands.add(editorElement, {
        'ayapi-webview:load': this.load.bind(this),
        'ayapi-webview:load-as-new': this.loadAsNew.bind(this),
        'core:cancel': this.cancel.bind(this)
      })
    );
    
    this.session = remote.session.fromPartition('persist:atom-ayapi-webview', {
      cache: false
    });
  },

  deactivate() {
    this.editor.destroy();
    this.editor = null;
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
    this.subscriptions.dispose();
    this.models.forEach((model) => {
      let pane = atom.workspace.paneForURI(model.uri);
      if (pane) {
        pane.destroyItem(pane.itemForURI(model.uri));
      }
      let view = this.views.get(model.uri);
      if (view) {
        view.destroy();
      }
      model.destroy();
    });
    this.models = [];
    this.views = new Map();
    this.session = null;
  },

  serialize() {
    return {
      models: this.models.map((model) => {
        return model.serialize();
      })
    }
  },
  
  deserializeAyapiWebviewElement(state) {
    state.findInPage = atom.deserializers.deserialize(state.findInPage);
    
    let view = new AyapiWebviewElement();
    view.initialize(state);
    this.views.set(state.uri, view);
    return view;
  },
  
  deserializeAyapiWebviewFindInPageElement(state) {
    let element = new AyapiWebviewFindInPageElement();
    element.initialize(state);
    return element;
  },
  
  buildView(model) {
    if (model instanceof AyapiWebview) {
      view = new AyapiWebviewElement();
      view.initialize({
        uri: model.uri
      });
      view.setModel(model);
      return view;
    }
  },
  
  bindViewEvents(view) {
    this.subscriptions.add(
      view.onWillOpenNewWindow(this.handleNewWindow.bind(this))
    );
  },
  
  handleNewWindow(ev) {
    if (ev.disposition === 'new-window') {
      openInDefaultBrowser(ev.url);
      return;
    }
    if (ev.disposition === 'background-tab') {
      let fromPane = atom.workspace.getActivePane();
      let fromItem = atom.workspace.getActivePaneItem();
      let disposable = atom.workspace.onDidOpen(() => {
        disposable.dispose();
        fromPane.activate();
        fromPane.activateItem(fromItem);
      });
    }
    const protocol = url.parse(ev.url).protocol;
    if (protocol === 'http:' || protocol === 'https:') {
      atom.workspace.open(ev.url);
    }
  },
  
  load(ev) {
    let pane = atom.workspace.getActivePane();
    let item = pane.getActiveItem();
    if (!(item && item.constructor.name === 'ayapi-webview')) {
      this.loadAsNew(ev);
      return;
    }
    let webviewElement = atom.views.getView(item);
    let address = this.convertInvalidURLToGoogle(this.editor.getText());
    webviewElement.loadURL(address);
    webviewElement.focus();
    this.panel.hide();
  },
  
  loadAsNew(ev) {
    let address = this.convertInvalidURLToGoogle(this.editor.getText());
    atom.workspace.open(address);
    this.panel.hide();
  },
  
  convertInvalidURLToGoogle(address) {
    if (url.parse(address).protocol) {
      return address;
    }
    if (address.includes('.') && isWebUri('http://' + address)) {
      return 'http://' + address;
    }
    return `https://www.google.co.jp/search?q=${encodeURIComponent(address)}`;
  },
  
  storeFocusedElement() {
    this.previouslyFocusedElement = document.activeElement;
  },
  
  restoreFocus() {
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
    }
  },
  
  showAddressEditor() {
    if (!this.panel) {
      this.panel = atom.workspace.addModalPanel({
        item: this.editor,
        visible: false
      });
    }
    this.storeFocusedElement();
    let pane = atom.workspace.getActivePane();
    let item = pane.getActiveItem();
    if (item && item.constructor.name === 'ayapi-webview') {
      this.editor.setText(item.getURL());
    }
    this.panel.show();
    atom.views.getView(this.editor).focus();
    this.editor.selectAll();
  },
  
  cancel(ev) {
    this.restoreFocus();
    this.panel.hide();
  },

  open() {
    atom.workspace.open(this.generateURI());
  },
  
  generateURI() {
    return `ayapi-webview://${Math.random().toString(36)}${Date.now().toString(36)}`;
  }
};
