'use babel';
import { Task, CompositeDisposable } from 'atom';
import path from 'path';
import Terminal from 'xterm';

export default class AyapiTermView {
  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('ayapi-term');

    this.subscriptions = new CompositeDisposable();
    this.subscriptionForResize = new CompositeDisposable();
    
    this.pwd = path.resolve('~/.atom');
    this.shell = 'zsh';
    this.args = [];
    this.paneId = -1;
    this.id = serializedState.id;
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      id: this.id,
      paneId: this.paneId,
      pwd: this.pwd,
      shell: this.shell,
      args: this.args
    }
  }

  // Tear down any state and detach
  destroy() {
    this.subscriptions.dispose();
    this.subscriptionForResize.dispose();
    if (this.ptyProcess) {
      this.ptyProcess.terminate();
    }
    if (this.terminal) {
      this.terminal.destroy();
    }
    this.element.remove();
  }

  getElement() {
    return this.element;
  }
  
  setPane() {
    let pane = atom.workspace.paneForItem(this);
    this.paneId = pane.id;
    this.subscriptionForResize.add(
      pane.onDidChangeFlexScale((scale) => {
        this.resizeTerminalToView();
      })
    );
    this.subscriptionForResize.add(
      pane.onDidRemoveItem((ev) => {
        let {item} = ev;
        if (item.id === this.id) {
          this.subscriptionForResize.dispose();
        }
      })
    );
  }
  
  displayTerminal() {
    let {cols, rows} = this.getDimensions();
    this.ptyProcess = this.forkPtyProcess();
    this.terminal = new Terminal({
      scrollback: 2000,
      cols: cols,
      rows: rows,
      cursorBlink: true
    });
    this.attachListeners();
    this.terminal.open(this.element);
  }
  
  forkPtyProcess() {
    return Task.once(
      require.resolve('./process'),
      path.resolve(this.pwd),
      this.shell,
      this.args
    );
  }
  
  getDimensions() {
    let cols, rows, fakeCol;
    let fakeRow = document.createElement('div');
    let fakeRowSpan = document.createElement('span');
    fakeRowSpan.innerHTML = '&nbsp;';
    fakeRow.appendChild(fakeRowSpan);
    
    if (this.terminal) {
      this.element.appendChild(fakeRow);
      fakeCol = fakeRow.children[0].getBoundingClientRect();
      cols = Math.floor(this.element.clientWidth / (fakeCol.width || 9));
      rows = Math.floor(this.element.clientHeight / (fakeCol.height || 20));
      
      // this.rowHeight = fakeCol.height;
      fakeRow.remove();
    } else {
      cols = Math.floor(this.element.clientWidth / 9);
      rows = Math.floor(this.element.clientHeight / 20);
    }
    console.log(cols, rows);
    return {
      cols: cols,
      rows: rows
    };
  }
  
  resizeTerminalToView() {
    let {cols, rows} = this.getDimensions();
    
    if (!(cols > 0 && rows > 0)) {
      return;
    }
    if (!this.terminal) {
      return;
    }
    if (this.terminal.rows === rows && this.terminal.cols === cols) {
      return;
    }
    this.resize(cols, rows);
    this.terminal.resize(cols, rows);
  }
  
  attachListeners() {
    this.ptyProcess.on("ayapi-term:data", (data) => {
      this.terminal.write(data);
    });
    this.terminal.end = () => {
      this.destroy();
    };
    this.terminal.on("data", (data) => {
      this.input(data);
    });
    this.ptyProcess.on("ayapi-term:title", (title) => {
      this.process = title;
    });
    this.terminal.on("title", (title) => {
      this.title = title;
    });
    this.terminal.once("open", () => {
      this.resizeTerminalToView();
    });
  }
  
  input(data) {
    if (this.ptyProcess.childProcess == null) {
      return;
    }
    // this.terminal.stopScrolling();
    return this.ptyProcess.send({
      event: 'input',
      text: data
    });
  }
  
  resize(cols, rows) {
    if (this.ptyProcess.childProcess == null) {
      return;
    }
    return this.ptyProcess.send({
      event: 'resize',
      rows: rows,
      cols: cols
    });
  }
  
  focus() {
    if (!this.terminal) {
      return;
    }
    this.terminal.focus();
    if (this.terminal._textarea) {
      this.terminal._textarea.focus();
    } else {
      this.terminal.element.focus();
    }
  }
  
  blur() {
    if (!this.terminal) {
      return;
    }
    this.terminal.blur();
    this.terminal.element.blur();
  }
}
