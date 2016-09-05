'use babel';
import { EventsDelegation, DisposableEvents } from 'atom-utils';
import { CompositeDisposable, Disposable, Emitter } from 'atom';

class AyapiWebviewFindInPageElement extends HTMLElement {
  get visible() {
    return this._visible;
  }
  set visible(value) {
    this._visible = value;
    this.style.display = value ? null : 'none';
  }
  get current() {
    return this._current;
  }
  set current(value) {
    this._current = value;
    this.currentNumberElement.textContent = value;
  }
  get total() {
    return this._total;
  }
  set total(value) {
    this._total = value;
    this.totalNumberElement.textContent = value;
  }
  
  constructor() {
    super();
    this._visible = false;
    this._current = 0;
    this._total = 0;
    
    this.editor = null;
    this.counterElement = null;
  }
  
  initialize(state) {
    this.visible = state.visible || false;
    if (state.text) {
      this.editor.setText(state.text);
    }
  }
  
  createdCallback() {
    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();
    
    this.setAttribute('tabindex', '-1');
    
    let editor = atom.workspace.buildTextEditor({
      mini: true,
      lineNumberGutterVisible: false,
      softWrapped: false
    });
    this.editor = editor;
    
    let editorElement = atom.views.getView(editor);
    editorElement.classList.add('ayapi-webview-find');
    this.bindEditorElementEvents(editorElement);
    this.appendChild(editorElement);
    
    this.appendChild(this.createCounterElement());
  }
  
  bindEditorElementEvents(editorElement) {
    this.subscriptions.add(
      this.addDisposableEventListener(editorElement, 'keydown', (ev) => {
        switch (ev.key) {
          case 'Escape':
            atom.commands.dispatch(editorElement, 'core:cancel');
            break;
        }
      })
    );
    
    this.subscriptions.add(
      this.addDisposableEventListener(editorElement, 'focus', (ev) => {
        this.editor.selectAll();
      })
    );
    this.subscriptions.add(
      this.addDisposableEventListener(this, 'focus', (ev) => {
        editorElement.focus();
      })
    );
    this.subscriptions.add(
      atom.commands.add(editorElement, {
        'ayapi-webview:find-next': () => this.find(1),
        'ayapi-webview:find-prev': () => this.find(-1),
        'core:cancel': () => this.cancel(),
      })
    );
  }
  
  createCounterElement() {
    let counterElement = document.createElement('div');
    counterElement.classList.add('ayapi-webview-find-count');
    
    let currentNumberElement = document.createElement('span');
    currentNumberElement.classList.add('ayapi-webview-find-count-current');
    currentNumberElement.textContent = this.current;
    counterElement.appendChild(currentNumberElement);
    this.currentNumberElement = currentNumberElement;
    
    let dividerElement = document.createElement('span');
    dividerElement.classList.add('ayapi-webview-find-count-divider');
    dividerElement.textContent = '/';
    counterElement.appendChild(dividerElement);
    
    let totalNumberElement = document.createElement('span');
    totalNumberElement.classList.add('ayapi-webview-find-count-total');
    totalNumberElement.textContent = this.total;
    counterElement.appendChild(totalNumberElement);
    this.totalNumberElement = totalNumberElement;
    
    this.current = 0;
    this.total = 0;
    
    return counterElement;
  }
  
  setText(text) {
    this.editor.setText(text);
  }
  
  find(direction) {
    let text = this.editor.getText();
    this.emitter.emit('find-request', {
      text: text,
      direction: direction
    });
  }
  
  cancel(ev) {
    this.emitter.emit('cancel');
  }
  
  onDidFindRequest(callback) {
    return this.emitter.on('find-request', callback);
  }
  
  onDidCancel(callback) {
    return this.emitter.on('cancel', callback);
  }
  
  hide() {
    this.visible = false;
  }
  
  show() {
    this.visible = true;
  }
  
  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      deserializer: 'AyapiWebviewFindInPageElement',
      text: this.editor ? this.editor.getText() : '',
      visible: this.visible
    };
  }
  
  destroy() {
    this.emitter.dispose();
    this.subscriptions.dispose();
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }
}

EventsDelegation.includeInto(AyapiWebviewFindInPageElement);

module.exports = AyapiWebviewFindInPageElement = document.registerElement(
  'ayapi-webview-find-in-page',
  {prototype: AyapiWebviewFindInPageElement.prototype}
)
