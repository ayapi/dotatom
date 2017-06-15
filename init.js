"use babel";

const path = require('path');
const os = require('os');
const electron = require('electron');

function requireAtomCoreModule(name) {
  return require(path.join(atom.packages.resourcePath, 'src', name));
}
const Pane = requireAtomCoreModule('pane');
const PaneAxis = requireAtomCoreModule('pane-axis');
const TextEditorComponent = requireAtomCoreModule('text-editor-component');

if (os.platform() == 'win32' && os.release().startsWith('10.')) {
  // currently `transparent` isnt supported on win10 
  document.body.style.backgroundColor = "#000";
}

let cursorBlinkInterval = 1000;
TextEditorComponent.prototype.cursorBlinkPeriod = cursorBlinkInterval;
function setCursorBlinkInterval(editor) {
  // ref. https://github.com/olmokramer/atom-cursor-blink-interval
  let editorView = atom.views.getView(editor);
  if(!editorView.component || !editorView.component.presenter){
    return;
  }
  let editorPresenter = editorView.component.presenter;
  editorPresenter.stopBlinkingCursors(true);
  editorPresenter.cursorBlinkPeriod = cursorBlinkInterval;
  editorPresenter.startBlinkingCursors();
}
atom.workspace.observeTextEditors(setCursorBlinkInterval);

Function.prototype.clone = function() {
  var that = this;
  var temp = function temporary() { return that.apply(this, arguments); };
  for(var key in this) {
    if (this.hasOwnProperty(key)) {
      temp[key] = this[key];
    }
  }
  return temp;
};

function fixSoftWrapToWordBreakable(editor) {
  editor.displayLayer.reset({
    isWrapBoundary: function() { return true; }
  });
  if (editor.displayLayer.___reset) return;
  editor.displayLayer.___reset = editor.displayLayer.reset.clone();
  editor.displayLayer.reset = function(params) {
    delete params.isWrapBoundary;
    this.___reset(params);
  }
}
atom.workspace.observeTextEditors(fixSoftWrapToWordBreakable);

function fixSoftWrapColumnLength(editor) {
  editor.getSoftWrapColumn = function() {
    if (!this.isSoftWrapped()) return Infinity;
    if (this.softWrapAtPreferredLineLength) {
      return Math.min(this.getEditorWidthInChars(), this.preferredLineLength) - 1;
    } else {
      return this.getEditorWidthInChars() - 1;
    }
  }.bind(editor);
}
atom.workspace.observeTextEditors(fixSoftWrapColumnLength);

atom.workspace.onDidOpen((ev) => {
  let {item, pane} = ev;
  let items = pane.getItems();
  items.forEach((pitem) => {
    if (
      pitem != item
      && pitem.constructor.name == 'TextEditor'
      && pitem.isEmpty()
      && !pitem.isModified()
      && pitem.getTitle() == 'untitled'
    ) {
      pane.destroyItem(pitem);
    }
  });
  
  items = pane.getItems();
  
  let isWebviewPane = items.every((item) => {
    return item.constructor.name == 'ayapi-webview'
  });
  if (isWebviewPane) return;
  
  if (items.length > 1) {
    let newPane = pane.splitDown();
    pane.moveItemToPane(item, newPane, 0);
  }
});

atom.workspace.onDidStopChangingActivePaneItem(() => {
  atom.project.getRepositories().forEach((repo) => {
    if (!repo) return;
    repo.refreshStatus();
  });
});

function moveModalPanel(panel) {
  let activePane = atom.workspace.getActivePane();
  let activePaneElement = atom.views.getView(activePane);
  let rect = activePaneElement.getBoundingClientRect();
  let panelElement = atom.views.getView(panel);
  panelElement.style.top = Math.floor(rect.top) + 'px';
  panelElement.style.left = Math.floor(rect.left) + 'px';
  panelElement.style.width = Math.floor(rect.width) + 'px';
}

atom.workspace.panelContainers.modal.onDidAddPanel((params) => {
  let {panel} = params;
  if (panel.isVisible()) {
    moveModalPanel(panel);
  }
  panel.onDidChangeVisible((visible) => {
    if (visible) {
      moveModalPanel(panel);
    }
  });
});

function scrollEditor(amount) {
  let pane = atom.workspace.getActivePane();
  if (!pane) {
    return;
  }
  let item = pane.getActiveItem();
  if (!item) {
    return;
  }
  item.setScrollTop(item.getScrollTop() + item.getLineHeightInPixels() * amount);
}

atom.commands.add('atom-workspace atom-text-editor:not(mini)', 'custom:editor-scroll-down', () => {
  scrollEditor(3);
});
atom.commands.add('atom-workspace atom-text-editor:not(mini)', 'custom:editor-scroll-up', () => {
  scrollEditor(-3);
});

atom.commands.add('atom-workspace', 'custom:split-right-and-new-editor', () => {
  let pane = atom.workspace.getActivePane();
  pane.splitRight();
  atom.workspace.open();
});

atom.commands.add('atom-workspace', 'custom:split-down-and-new-editor', () => {
  let pane = atom.workspace.getActivePane();
  pane.splitDown();
  atom.workspace.open();
});

atom.commands.add('atom-workspace', 'custom:split-global-right-and-new-editor', () => {
  let pane = atom.workspace.getActivePane();
  let newPane = new Pane({
    applicationDelegate: pane.applicationDelegate,
    notificationManager: pane.notificationManager,
    deserializerManager: pane.deserializerManager,
    config: pane.config
  });
  
  let p = pane;
  while(true) {
    if (p.parent.constructor.name == 'PaneContainer') {
      break;
    }
    p = p.parent;
  }
  
  let pname = p.constructor.name;
  if (pname == 'Pane'
      || (pname == 'PaneAxis' && p.orientation !== 'horizontal')) {
    let parent = p.parent;
    let newAxis = new PaneAxis({
      orientation: 'horizontal',
      children: [p]
    });
    parent.replaceChild(p, newAxis);
    newAxis.setFlexScale(1);
    p.setFlexScale(1);
    newAxis.addChild(newPane);
  } else {
    let pc = pane;
    while(true) {
      if (pc.parent.parent.constructor.name == 'PaneContainer') {
        break;
      }
      pc = pc.parent;
    }
    pc.parent.insertChildAfter(pc, newPane);
  }
  
  newPane.activate();
  atom.workspace.open();
});

atom.commands.add(
  'atom-workspace atom-pane',
  'custom:close-pane-and-focus-previous-if-possible',
  () => {
    let pane = atom.workspace.getActivePane();
    if (pane.parent.constructor.name === 'PaneAxis') {
      let siblings = pane.parent.children;
      let panes = siblings;
      if (siblings.length <= 1) {
        panes = atom.workspace.getPanes();
      }
      let index = panes.indexOf(pane);
      let nextIndex = index === 0 ? 1 : index - 1;
      let nextTarget = panes[nextIndex];
      if (nextTarget.constructor.name === 'PaneAxis') {
        nextTarget = nextTarget.children[nextTarget.children.length - 1];
      }
      
      pane.onDidDestroy(() => {
        nextTarget.activate();
      });
    }
    pane.close();
  }
);

atom.commands.add('atom-workspace', 'window:maximize-on-dual-display', () => {
  let displaySize = {w: 1920, h: 1200};
  atom.setPosition(0, 0);
  atom.setSize(displaySize.h * 2, displaySize.w);
});

atom.commands.add('atom-workspace', 'window:maximize-on-external-display', () => {
  let displays = electron.screen.getAllDisplays();
  if (displays.length < 2) {
    return;
  }
  let bounds = displays[1].bounds
  atom.setPosition(bounds.x, bounds.y);
  
  if (displays.length > 2) {
    let externalDisplays = displays.slice(1)
    if (externalDisplays.map(d => (d.bounds.y)).every((curr, i, arr) => (arr[0] === curr))) {
      let w = externalDisplays.reduce((prev, curr) => (prev + curr.bounds.width), 0);
      atom.setSize(w, bounds.height);
      return;
    }
  }
  atom.setSize(bounds.width, bounds.height);
});

atom.commands.add('atom-workspace', 'window:maximize', () => {
  atom.getCurrentWindow().maximize();
});

atom.commands.add('atom-workspace', 'window:unmaximize', () => {
  atom.getCurrentWindow().unmaximize();
});
