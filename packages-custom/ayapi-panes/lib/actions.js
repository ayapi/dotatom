'use babel';

function getNeighborPaneViewInDirection(direction) {
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
  if (item && item.constructor.name == 'TextEditor' && item.cursors.length > 0) {
    let cursor = item.cursors.find((cursor) => {
      return cursor.isVisible();
    });
    if (cursor) {
      let editorView = atom.views.getView(item);
      let cursorRect = editorView.pixelPositionForScreenPosition(cursor.getScreenPosition())
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

export default {
  focusPane(direction) {
    let target = getNeighborPaneViewInDirection(direction);
    if(!target) return;
    target.focus();
  },
  swapPane(direction) {
    let fromPane = atom.workspace.getActivePane();
    let fromItem = fromPane.getActiveItem();
    let toPaneView = getNeighborPaneViewInDirection(direction);
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
  },
  movePane (direction) {
    let fromPane = atom.workspace.getActivePane();
    let fromItem = fromPane.getActiveItem();
    let collisionPaneView = getNeighborPaneViewInDirection(direction);
    if (!collisionPaneView) return;
    let collisionPane = collisionPaneView.getModel();
    collisionPane.splitDown();
    let toPane = atom.workspace.getActivePane();
    fromPane.moveItemToPane(fromItem, toPane, 0);
  }
}
