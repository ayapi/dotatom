'use babel';

import { CompositeDisposable, Disposable } from 'atom';
import { remote } from 'electron';
import actions from './actions';

export default {

  subscriptions: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    
    [
      atom.commands.add(
        'atom-workspace atom-pane',
        'ayapi-panes:focus-pane-on-left',
        () => actions.focusPane('left')
      ),
      atom.commands.add(
        'atom-workspace atom-pane',
        'ayapi-panes:focus-pane-on-right',
        () => actions.focusPane('right')
      ),
      atom.commands.add(
        'atom-workspace atom-pane',
        'ayapi-panes:focus-pane-above',
        () => actions.focusPane('above')
      ),
      atom.commands.add(
        'atom-workspace atom-pane',
        'ayapi-panes:focus-pane-below',
        () => actions.focusPane('below')
      ),
      atom.commands.add(
        'atom-workspace',
        'ayapi-panes:swap-pane-with-right',
        () => actions.swapPane('right')
      ),
      atom.commands.add(
        'atom-workspace',
        'ayapi-panes:swap-pane-with-left',
        () => actions.swapPane('left')
      ),
      atom.commands.add(
        'atom-workspace',
        'ayapi-panes:swap-pane-with-above',
        () => actions.swapPane('above')
      ),
      atom.commands.add(
        'atom-workspace',
        'ayapi-panes:swap-pane-with-below',
        () => actions.swapPane('below')
      ),
      atom.commands.add(
        'atom-workspace',
        'ayapi-panes:move-pane-to-right',
        () => actions.movePane('right')
      ),
      atom.commands.add(
        'atom-workspace',
        'ayapi-panes:move-pane-to-left',
        () => actions.movePane('left')
      )
    ].forEach(disposable => this.subscriptions.add(disposable));
  },

  deactivate() {
    this.subscriptions.dispose();
  }
};
