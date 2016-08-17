'use babel';
import { Emitter, Task, CompositeDisposable, Disposable } from 'atom';
import path from 'path';

export default class AyapiTermModel {
  constructor(state) {
    this.emitter = new Emitter();
    this.subscriptions = new CompositeDisposable();
    
    let defaults = {
      pwd: this.detectPwd(),
      shell: process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || 'bash'),
      args: [],
      cols: 60,
      rows: 5
    }
    let propnames = Object.keys(defaults);
    if (state) {
      for (propname of propnames) {
        if (state.hasOwnProperty(propname)) {
          defaults[propname] = state[propname];
        }
      }
    }
    for (propname of propnames) {
      this[propname] = defaults[propname];
    }
    
    this.uri = state.uri;
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      deserializer: 'AyapiTermModel',
      pwd: this.pwd,
      shell: this.shell,
      args: this.args,
      cols: this.cols,
      rows: this.rows,
      uri: this.uri,
    }
  }
  
  static deserialize(state) {
    return new AyapiTermModel(state);
  }

  // Tear down any state and detach
  destroy() {
    this.emitter.dispose();
    this.subscriptions.dispose();
    if (this.ptyProcess) {
      this.ptyProcess.terminate();
    }
  }
  
  start() {
    this.ptyProcess = this.forkPtyProcess();
  }
  
  forkPtyProcess() {
    return Task.once(
      require.resolve('./process'),
      path.resolve(this.pwd),
      this.shell,
      this.args,
      {
        cols: this.cols,
        rows: this.rows
      }
    );
  }
  
  onDidReceiveData(callback) {
    this.ptyProcess.on("ayapi-term:data", callback);
  }
  
  sendInput(data) {
    if (this.ptyProcess.childProcess == null) {
      return;
    }
    return this.ptyProcess.send({
      event: 'input',
      text: data
    });
  }
  
  sendResize(cols, rows) {
    if (this.ptyProcess.childProcess == null) {
      return;
    }
    return this.ptyProcess.send({
      event: 'resize',
      rows: rows,
      cols: cols
    });
  }
  
  detectPwd() {
    let projectFolder = atom.project.getPaths()[0];
    let activeEditor = atom.workspace.getActiveTextEditor();
    let editorPath = activeEditor != null ? activeEditor.getPath() : null;
    let editorFolder = '';
    if (editorPath != null) {
      editorFolder = path.dirname(editorPath);
      let projectPaths = atom.project.getPaths();
      for (j = 0, len = projectPaths.length; j < len; j++) {
        directory = projectPaths[j];
        if (editorPath.indexOf(directory) >= 0) {
          projectFolder = directory;
        }
      }
    }
    if (projectFolder != null && projectFolder.indexOf('atom://') >= 0) {
      projectFolder = null;
    }
    let home = process.platform === 'win32' ? process.env.HOMEPATH : process.env.HOME;
    
    return projectFolder || editorFolder || home;
  }
}

