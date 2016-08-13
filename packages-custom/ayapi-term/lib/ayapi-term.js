'use babel';

import AyapiTermView from './ayapi-term-view';
import { CompositeDisposable } from 'atom';

export default {

  views: [],
  subscriptions: null,
  count: -1,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ayapi-term:open': () => this.open()
    }));
    
    this.subscriptions.add(
      atom.workspace.onDidStopChangingActivePaneItem((item) => {
        if (item.constructor.name === 'AyapiTermView') {
          item.focus();
        }
      })
    );
    this.subscriptions.add(
      atom.workspace.onDidAddPaneItem((ev) => {
        let {item, pane} = ev;
        if (item.constructor.name === 'AyapiTermView') {
          item.paneId = pane.id;
        }
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
    this.views.forEach((view) => {
      view.destroy();
    });
  },

  serialize() {
    return this.views.map((view) => {
      return view.serialize();
    });
  },

  open() {
    let pane = atom.workspace.getActivePane();
    this.count++;
    let view = new AyapiTermView({id: this.count});
    this.views.push(view);
    pane.addItem(view);
    pane.activateItem(view);
    view.displayTerminal();
    view.focus();
  }
};
