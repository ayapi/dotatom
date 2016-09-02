'use babel';

import url from 'url';
import AyapiTermElement from './ayapi-term-element';
import AyapiTermModel from './ayapi-term';
import { CompositeDisposable } from 'atom';

atom.deserializers.add(AyapiTermModel);

export default {

  views: new Map(),
  models: [],
  subscriptions: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ayapi-term:open': () => this.open()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace .ayapi-term', {
      'ayapi-term:scroll-down': (ev) => {
        ev.currentTarget.scroll(3);
      },
      'ayapi-term:scroll-up': (ev) => {
        ev.currentTarget.scroll(-3);
      }
    }));
    
    this.subscriptions.add(
      atom.workspace.addOpener((uri) => {
        let {protocol} = url.parse(uri);
        if (protocol !== 'ayapi-term:') return;
        let model = new AyapiTermModel({uri: uri});
        this.models.push(model);
        return atom.views.getView(model);
      })
    );
    
    if (state && state.models) {
      state.models.forEach((s) => {
        let view = this.views.get(s.uri);
        if (!view) return;
        
        let model = atom.deserializers.deserialize(s);
        this.models.push(model);
        view.setModel(model);
      });
    }
    
    this.subscriptions.add(
      atom.workspace.onDidStopChangingActivePaneItem((item) => {
        if (item && item.constructor.name === 'AyapiTermView') {
          item.focus();
        }
      })
    );
  },

  deactivate() {
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
  },

  serialize() {
    return {
      models: this.models.map((model) => {
        return model.serialize();
      })
    }
  },
  
  deserializeAyapiTermElement(state) {
    console.log('deserializeAyapiTermElement');
    console.log(state);
    let view = new AyapiTermElement();
    view.initialize(state);
    this.views.set(state.uri, view);
    return view;
  },
  
  buildView(model) {
    if (model instanceof AyapiTermModel) {
      console.log('buildView');
      console.log(model);
      
      view = new AyapiTermElement();
      view.initialize({
        uri: model.uri,
        title: 'xterm'
      });
      view.setModel(model);
      return view;
    }
  },

  open() {
    atom.workspace.open(this.generateURI());
  },
  
  generateURI() {
    return `ayapi-term://${Math.random().toString(36)}${Date.now().toString(36)}`;
  }
};
