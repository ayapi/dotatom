const EventEmitter = require('events').EventEmitter;
const diff = require('deep-diff').diff;

class Highlight extends EventEmitter {
  constructor(markerPair) {
    super();
    
    this.markerPair = markerPair;
    this.range = this.createRange();
    this.selection = null;
    this.target = null;
    this.rects = [];
    this.timer = setInterval(this.update.bind(this), 60);
  }
  createRange() {
    const range = document.createRange();
    range.setStartAfter(this.markerPair[0]);
    range.setEndBefore(this.markerPair[1]);
    return range;
  }
  update() {
    const {target, rects} = this.getVisibleAncestor(this.range);
    if (this.target != target) {
      this.target = target;
      try {
        target.focus();
      } catch(err) {}
    }
    
    if (diff(rects, this.rects)) {
      this.rects = rects;
      this.emit('did-change-rects', rects);
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
    let rects;
    while(!rects) {
      rects = [... target.getClientRects()];
      let areCollapsed = rects.every((rect) => {
        return rect.width == 0 && rect.height == 0;
      });
      if (areCollapsed) {
        rects = [];
      }
      if (rects.length == 0) {
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
      rects: rects.map(rect => {
        return {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        }
      })
    };
  }
  destroy() {
    clearInterval(this.timer);
    this.range.detach();
    this.range = null;
    this.target = null;
    this.rect = null;
    this.emit('did-destroy');
    this.removeAllListeners();
  }
}

module.exports = Highlight;
