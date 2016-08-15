'use babel';
import { CompositeDisposable, Emitter } from 'atom';
import Terminal from 'xterm';
import fit from 'xterm/addons/fit/fit';

class AyapiTermElement extends HTMLElement {
  initialize(state) {
    this.emitter = new Emitter();
    
    this.uri = state.uri;
    this._title = state.title;
    
    this.classList.add('ayapi-term');
    this.setAttribute('tabindex', '-1');
    
    this.intervalId = null;
  }
  
  createdCallback() {
    this.subscriptions = new CompositeDisposable();
  }
  
  setModel(model) {
    this.model = model;
    
    this.model.start();
    this.terminal = new Terminal({
      scrollback: 2000,
      cursorBlink: true,
      cols: this.model.cols,
      rows: this.model.rows
    });
    this.attachListeners();
    this.terminal.open(this);
    this.terminal.attachCustomKeydownHandler(
      this.handleKeymapsOnTerminal.bind(this)
    );
    
    this.intervalId = setInterval(() => {
      this.fit();
    }, 200);
  }
  
  attachListeners() {
    this.model.onDidReceiveData((data) => {
      this.terminal.write(data);
    });
    this.terminal.end = () => {
      this.destroy();
    };
    this.terminal.on("data", (data) => {
      this.model.sendInput(data);
    });
    this.terminal.on("title", (title) => {
      this._title = title;
      this.emitter.emit('did-change-title', title);
    });
  }
  
  handleKeymapsOnTerminal(ev) {
    let keystroke = atom.keymaps.keystrokeForKeyboardEvent(ev);
    let bindings = atom.keymaps.findKeyBindings({
      keystrokes: keystroke,
      target: this.querySelector('.xterm')
    }).filter((binding) => {
      return binding.selector.endsWith('ayapi-term .xterm')
    });
    if (bindings.length > 0) {
      return false;
    }
    return true;
  }
  
  fit() {
    if (!this.terminal) {
      return;
    }
    if (this.style.display == 'none') {
      return;
    }
    let {cols, rows} = this.terminal.proposeGeometry();
    if (Number.isInteger(cols) && Number.isInteger(rows)
        && this.model.cols !== cols || this.model.rows !== rows) {
      this.model.cols = cols;
      this.model.rows = rows;
      this.terminal.resize(cols, rows);
      this.model.sendResize(cols, rows);
    }
  }
  
  scroll(amount) {
    if (!this.terminal) {
      return;
    }
    this.terminal.scrollDisp(amount);
  }
  
  focus() {
    if (!this.terminal) {
      return;
    }
    this.terminal.focus();
  }
  
  onDidChangeTitle(callback) {
    return this.emitter.on('did-change-title', callback);
  }
  
  getTitle() {
    return this._title;
  }
  
  getURI() {
    return this.uri;
  }
  
  serialize() {
    return {
      deserializer: 'AyapiTermElement',
      title: this.getTitle(),
      uri: this.getURI()
    }
  }
  
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.terminal) {
      this.terminal.destroy();
    }
  }
}

module.exports = AyapiTermElement = document.registerElement(
  'ayapi-term',
  {prototype: AyapiTermElement.prototype}
)
