"use babel";

const path = require('path');
const os = require('os');

function requireAtomCoreModule(name) {
  return require(path.join(atom.packages.resourcePath, 'src', name));
}
const Pane = requireAtomCoreModule('pane');
const PaneAxis = requireAtomCoreModule('pane-axis');

if (os.platform() == 'win32' && os.release().startsWith('10.')) {
  // currently `transparent` isnt supported on win10 
  document.body.style.backgroundColor = "#000";
}

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

function neighborPaneViewInDirection(direction) {
  let pane = atom.workspace.getActivePane();
  let paneView = atom.views.getView(pane);
  let box = paneView.getBoundingClientRect();
  let paneContainerView = atom.views.getView(pane.container);
  let paneViews = Array.from(paneContainerView.querySelectorAll('atom-pane'));
  
  let matchedViews = paneViews.filter((curr) => {
    let currBox = curr.getBoundingClientRect();
    switch (direction) {
      case 'left':
        return currBox.right <= box.left;
      case 'right':
        return currBox.left >= box.right;
      case 'above':
        return currBox.bottom <= box.top;
      case 'below':
        return currBox.top >= box.bottom;
    }
  });
  if (matchedViews.length == 0) {
    return null;
  }
  let nearestValue = matchedViews.reduce((prev, curr) => {
    let prevBox = prev.getBoundingClientRect();
    let currBox = curr.getBoundingClientRect();
    switch (direction) {
      case 'left':
        if (currBox.right >= prevBox.right) {
          return curr;
        }
        return prev;
      case 'right':
        if (currBox.left <= prevBox.left) {
          return curr;
        }
        return prev;
      case 'above':
        if (currBox.bottom >= prevBox.bottom) {
          return curr;
        }
        return prev;
      case 'below':
        if (currBox.top <= prevBox.top) {
          return curr;
        }
        return prev;
    }
  });
  
  let boxForintersect = box;
  let item = pane.getActiveItem();
  if (item.constructor.name == 'TextEditor' && item.cursors.length > 0) {
    let cursor = item.cursors.find((cursor) => {
      return cursor.isVisible();
    });
    if (cursor) {
      let cursorRect = cursor.getPixelRect();
      let editorView = atom.views.getView(item);
      let editorRect = editorView.getBoundingClientRect();
      let editorScroll = {
        top: editorView.getScrollTop(),
        left: editorView.getScrollLeft()
      }
      if (cursorRect.top >= editorScroll.top
        && cursorRect.top + cursorRect.height <= editorScroll.top + editorRect.height
        && cursorRect.left >= editorScroll.left
        && cursorRect.left + cursorRect.width <= editorScroll.left + editorRect.width
      ) {
        let vertical = cursorRect.top + editorRect.top - editorScroll.top;
        let horizontal = cursorRect.left + editorRect.left - editorScroll.left;
        boxForintersect = {
          left: horizontal,
          right: horizontal,
          top: vertical,
          bottom: vertical
        }
      }
    }
  }
  let origin;
  switch (direction) {
    case 'left':
    case 'right':
      origin = boxForintersect.top + (boxForintersect.bottom - boxForintersect.top) / 2;
      break;
    case 'above':
    case 'below':
      origin = boxForintersect.left + (boxForintersect.right - boxForintersect.left) / 2;
      break;
  }
  return matchedViews
    .find((curr) => {
      let nearestValueBox = nearestValue.getBoundingClientRect();
      let currBox = curr.getBoundingClientRect();
      switch (direction) {
        case 'left':
          if (currBox.right != nearestValueBox.right) {
            return false;
          }
          break;
        case 'right':
          if (currBox.left != nearestValueBox.left) {
            return false;
          }
          break;
        case 'above':
          if (currBox.bottom != nearestValueBox.bottom) {
            return false;
          }
          break;
        case 'below':
          if (currBox.top != nearestValueBox.top) {
            return false;
          }
          break;
      }
      
      switch (direction) {
        case 'left':
        case 'right':
          return (currBox.top <= origin && origin <= currBox.bottom);
        case 'above':
        case 'below':
          return (currBox.left <= origin && origin <= currBox.right);
      }
    });
}
atom.commands.add('atom-workspace atom-pane', 'custom:focus-pane-on-left', () => {
  let target = neighborPaneViewInDirection('left')
  if(!target) return;
  target.focus();
});
atom.commands.add('atom-workspace atom-pane', 'custom:focus-pane-on-right', () => {
  let target = neighborPaneViewInDirection('right')
  if(!target) return;
  target.focus();
});
atom.commands.add('atom-workspace atom-pane', 'custom:focus-pane-above', () => {
  let target = neighborPaneViewInDirection('above')
  if(!target) return;
  target.focus();
});
atom.commands.add('atom-workspace atom-pane', 'custom:focus-pane-below', () => {
  let target = neighborPaneViewInDirection('below')
  if(!target) return;
  target.focus();
});

function swapPane (direction) {
  let fromPane = atom.workspace.getActivePane();
  let fromItem = fromPane.getActiveItem();
  let toPaneView = neighborPaneViewInDirection(direction);
  if (!toPaneView) return;
  
  let toPane = toPaneView.getModel();
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
  toPane.activate();
}

atom.commands.add('atom-workspace', 'custom:swap-pane-with-right', () => {
  swapPane('right');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-left', () => {
  swapPane('left')
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-up', () => {
  swapPane('above');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-down', () => {
  swapPane('below');
});

function movePane (direction) {
  let fromPane = atom.workspace.getActivePane();
  let fromItem = fromPane.getActiveItem();
  let collisionPaneView = neighborPaneViewInDirection(direction);
  if (!collisionPaneView) return;
  let collisionPane = collisionPaneView.getModel();
  collisionPane.splitDown();
  let toPane = atom.workspace.getActivePane();
  fromPane.moveItemToPane(fromItem, toPane, 0);
}

atom.commands.add('atom-workspace', 'custom:move-pane-to-right', () => {
  movePane('right');
});
atom.commands.add('atom-workspace', 'custom:move-pane-to-left', () => {
  movePane('left');
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

atom.commands.add('atom-workspace', 'custom:maximizeOnDualDisplay', () => {
  let displaySize = {w: 1920, h: 1200};
  atom.setPosition(0, 0);
  atom.setSize(displaySize.h * 2, displaySize.w);
});
