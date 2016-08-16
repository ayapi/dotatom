"use babel";

const path = require('path');

function requireAtomCoreModule(name) {
  return require(path.join(atom.packages.resourcePath, 'src', name));
}
const Pane = requireAtomCoreModule('pane');
const PaneAxis = requireAtomCoreModule('pane-axis');


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
  if (items.length > 1) {
    let newPane = pane.splitDown();
    pane.moveItemToPane(item, newPane, 0);
  }
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

function scroll(amount) {
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

atom.commands.add('atom-pane', 'custom:scroll-down', () => {
  scroll(3);
});
atom.commands.add('atom-pane', 'custom:scroll-up', () => {
  scroll(-3);
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

function swapPane (direction) {
  let fromPane = atom.workspace.getActivePane();
  let fromItem = fromPane.getActiveItem();
  document.querySelector('atom-workspace')[`focusPaneView${direction}`]();
  let toPane = atom.workspace.getActivePane();
  
  console.log(fromPane.id, toPane.id);
  if (fromPane.id === toPane.id) {
    return;
  }
  let toItem = toPane.getActiveItem();
  
  if (toPane.getItems().length === 1) {
    toPane.addItem(atom.workspace.buildTextEditor());
  }
  if (fromPane.getItems().length === 1) {
    fromPane.addItem(atom.workspace.buildTextEditor());
  }
  
  toPane.moveItemToPane(toItem, fromPane, 0);
  fromPane.moveItemToPane(fromItem, toPane, 0);
  
  toPane.activateItem(fromItem);
  toPane.destroyInactiveItems();
  fromPane.activateItem(toItem);
  fromPane.destroyInactiveItems();
}

atom.commands.add('atom-workspace', 'custom:swap-pane-with-right', () => {
  swapPane('OnRight');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-left', () => {
  swapPane('OnLeft')
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-up', () => {
  swapPane('Above');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-down', () => {
  swapPane('Below');
});

function movePane (direction) {
  let fromPane = atom.workspace.getActivePane();
  let fromItem = fromPane.getActiveItem();
  document.querySelector('atom-workspace')[`focusPaneView${direction}`]();
  let collisionPane = atom.workspace.getActivePane();
  
  if (fromPane.id === collisionPane.id) {
    return;
  }
  
  collisionPane.splitDown();
  let toPane = atom.workspace.getActivePane();
  fromPane.moveItemToPane(fromItem, toPane, 0);
}

atom.commands.add('atom-workspace', 'custom:move-pane-to-right', () => {
  movePane('OnRight');
});
atom.commands.add('atom-workspace', 'custom:move-pane-to-left', () => {
  movePane('OnLeft');
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
