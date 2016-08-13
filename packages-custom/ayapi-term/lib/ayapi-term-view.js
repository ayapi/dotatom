'use babel';
import { Task, CompositeDisposable } from 'atom';
import path from 'path';
import Terminal from 'xterm';
import fit from 'xterm/addons/fit/fit';

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
    this.cols = 60;
    this.rows = 5;
    this.id = serializedState.id;
    
    this.watcher = null;
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      id: this.id,
      paneId: this.paneId,
      pwd: this.pwd,
      shell: this.shell,
      args: this.args,
      cols: this.cols,
      rows: this.rows
    }
  }

  // Tear down any state and detach
  destroy() {
    this.detachWatcher();
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
  
  displayTerminal() {
    this.ptyProcess = this.forkPtyProcess();
    this.terminal = new Terminal({
      scrollback: 2000,
      cursorBlink: true
    });
    this.terminal.open(this.element);
    this.terminal.fit();
    this.attachListeners();
    this.attachWatcher();
  }
  
  forkPtyProcess() {
    return Task.once(
      require.resolve('./process'),
      path.resolve(this.pwd),
      this.shell,
      this.args
    );
  }
  
  fit() {
    if (!this.terminal) {
      return;
    }
    let {cols, rows} = this.terminal.proposeGeometry();
    if (this.cols !== cols || this.rows !== rows) {
      this.cols = cols;
      this.rows = rows;
      this.terminal.resize(cols, rows);
      this.resize(cols, rows);
    }
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
  }
  
  attachWatcher() {
    this.watcher = setInterval(() => {
      this.fit();
    }, 500);
  }
  
  detachWatcher() {
    clearInterval(this.watcher);
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
