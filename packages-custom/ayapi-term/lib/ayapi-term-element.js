'use babel';
import { CompositeDisposable, Emitter } from 'atom';
import Terminal from 'xterm';

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
    this.terminal.open(this);
    this.attachListeners();
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
    let {cols, rows} = this.proposeGeometry();
    if (
      (!Number.isNaN(cols) && !Number.isNaN(rows) && cols > 2 && rows > 0)
      &&
      (this.model.cols !== cols || this.model.rows !== rows)
    ) {
      this.model.cols = cols;
      this.model.rows = rows;
      this.terminal.resize(cols, rows);
      this.model.sendResize(cols, rows);
    }
  }
  
  proposeGeometry() {
    let parentElementStyle = window.getComputedStyle(this.terminal.element.parentElement),
        parentElementHeight = parseInt(parentElementStyle.getPropertyValue('height')),
        parentElementWidth = parseInt(parentElementStyle.getPropertyValue('width')),
        elementStyle = window.getComputedStyle(this.terminal.element),
        elementPaddingVer = parseInt(elementStyle.getPropertyValue('padding-top')) + parseInt(elementStyle.getPropertyValue('padding-bottom')),
        elementPaddingHor = parseInt(elementStyle.getPropertyValue('padding-right')) + parseInt(elementStyle.getPropertyValue('padding-left')),
        availableHeight = parentElementHeight - elementPaddingVer,
        availableWidth = parentElementWidth - elementPaddingHor,
        container = this.terminal.rowContainer,
        subjectRow = this.terminal.rowContainer.firstElementChild,
        contentBuffer = subjectRow.innerHTML,
        characterHeight,
        rows,
        characterWidth,
        cols,
        geometry;

    let charSize = this.terminal.charMeasureElement.getBoundingClientRect();
    characterHeight = charSize.height || 16;
    characterWidth = charSize.width || 7;
    
    rows = parseInt(availableHeight / characterHeight);
    cols = parseInt(availableWidth / characterWidth);

    geometry = {cols: cols, rows: rows};
    return geometry;
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
    if (this.subscriptions) {
      this.subscriptions.dispose();
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.terminal) {
      this.terminal.destroy();
    }
    if (this.model) {
      this.model.destroy();
    }
  }
}

module.exports = AyapiTermElement = document.registerElement(
  'ayapi-term',
  {prototype: AyapiTermElement.prototype}
)
