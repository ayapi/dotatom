const EventEmitter = require('events').EventEmitter;
const diff = require('deep-diff').diff;

class Highlighter extends EventEmitter {
  constructor(markerPair) {
    super();
    
    this.markerPair = markerPair;
    this.range = this.createRange();
    this.selection = null;
    this.target = null;
    this.rect = {};
    this.timer = setInterval(this.update.bind(this), 60);
    this.addStyle();
  }
  addStyle() {
    const style = document.createElement('style');
    style.appendChild(document.createTextNode(''));
    document.head.appendChild(style);
    style.sheet.insertRule(
      '::selection {background: rgba(0,0,0,0.01) !important}'
    , 0);
    this.styleElement = style;
  }
  removeStyle() {
    this.styleElement.sheet.deleteRule(0);
    document.head.removeChild(this.styleElement);
    this.styleElement = null;
  }
  createRange() {
    const range = document.createRange();
    range.setStartAfter(this.markerPair[0]);
    range.setEndBefore(this.markerPair[1]);
    return range;
  }
  update() {
    const {target, rect} = this.getVisibleAncestor(this.range);
    if (this.target != target) {
      this.target = target;
      try {
        target.focus();
      } catch(err) {}
    }
    
    if (diff(rect, this.rect)) {
      this.rect = rect;
      this.emit('did-change-rect', rect);
    }
    
    if (!this.selection || (
      this.selection.isCollapsed && this.range.getClientRects().length
    )) {
      this.selection = window.getSelection();
      this.selection.removeAllRanges();
      this.selection.addRange(this.range);
    }
  }
  getVisibleAncestor(target) {
    let rect;
    while(!rect) {
      let rects = [... target.getClientRects()];
      if (rects.length > 0) {
        rect = rects.find((rect) => {
          return rect.width != 0 && rect.height != 0;
        }) || rects[0];
      }
      if (!rect) {
        let parent;
        if (target instanceof Range) {
          parent = target.commonAncestorContainer;
        } else {
          parent = target.parentNode;
        }
        if (parent.nodeType != 1) { // documentとかまで到達した
          break;
        }
        target = parent;
      }
    }
    return {
      target: target,
      rect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    };
  }
  destroy() {
    clearInterval(this.timer);
    this.removeStyle();
    this.removeAllListeners();
    this.range.detach();
    this.range = null;
    this.target = null;
    this.rect = null;
  }
}

module.exports = Highlighter;
