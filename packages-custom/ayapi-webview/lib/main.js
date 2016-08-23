'use babel';

import url from 'url';
import AyapiWebview from './ayapi-webview';
import AyapiWebviewElement from './ayapi-webview-element';
import { CompositeDisposable } from 'atom';

atom.deserializers.add(AyapiWebview);

export default {

  views: new Map(),
  models: [],
  subscriptions: null,
  panel: null,
  editor: null,

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
        return atom.views.getView(model);
      })
    );
    
    if (state && state.models) {
      state.models.forEach((s) => {
        let model = atom.deserializers.deserialize(s);
        this.models.push(model);
        
        let view = this.views.get(model.uri);
        if (view) {
          view.setModel(model);
        }
      });
    }
    
    let editor = atom.workspace.buildTextEditor({
      mini: true,
      lineNumberGutterVisible: false,
      placeholderText: 'http://'
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
  },

  deactivate() {
    atom.views.getView(this.editor).destroy();
    if (this.panel) {
      this.panel.destroy();
    }
    this.subscriptions.dispose();
    this.models.forEach((model) => {
      model.destroy();
      atom.views.getView(model).destroy();
    });
  },

  serialize() {
    return {
      models: this.models.map((model) => {
        return model.serialize();
      })
    }
  },
  
  deserializeAyapiWebviewElement(state) {
    let view = new AyapiWebviewElement();
    view.initialize(state);
    this.views.set(state.uri, view);
    return view;
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
  
  load(ev) {
    let pane = atom.workspace.getActivePane();
    let item = pane.getActiveItem();
    if (!(item instanceof AyapiWebviewElement)) {
      this.loadAsNew(ev);
      return;
    }
    let webviewElement = atom.views.getView(item);
    webviewElement.loadURL(this.editor.getText());
    webviewElement.focus();
    this.panel.hide();
  },
  
  loadAsNew(ev) {
    atom.workspace.open(this.editor.getText());
    this.panel.hide();
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
    if (item instanceof AyapiWebviewElement) {
      this.editor.setText(item.getURL());
    }
    this.panel.show();
    atom.views.getView(this.editor).focus();
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
