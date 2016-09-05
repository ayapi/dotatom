const EventEmitter = require('events').EventEmitter;
const escapeStringRegexp = require('escape-string-regexp');

const Highlighter = require('./Highlighter');

const elementName = "ayapi-webview-find-in-page-marker";
const skipElementNames = ['NOSCRIPT', 'SCRIPT', 'STYLE'];

class FindInPage extends EventEmitter {
  constructor() {
    super();
    this.text = '';
    this.current = 0;
    this.total = 0;
    this.registerElements();
  }
  registerElements() {
    document.registerElement(`${elementName}-start`, {
      extends: 'span',
      prototype: Object.create(HTMLSpanElement.prototype)
    });
    document.registerElement(`${elementName}-end`, {
      extends: 'span',
      prototype: Object.create(HTMLSpanElement.prototype)
    });
  }
  find(options) {
    if (options.text !== this.text) {
      this.total = this.markAll(options.text.split(' '));
      this.text = options.text;
      if (this.total > 0) {
        this.addHighlighter(0);
      }
    } else {
      this.current += options.direction;
      if (this.current > this.total - 1) {
        this.current = 0;
      }
      if (this.current < 0) {
        this.current = this.total - 1;
      }
      this.removeHighlighter();
      this.addHighlighter(this.current);
    }
    this.emit('did-find', {total: this.total, current: this.current});
  }
  clear() {
    this.removeHighlighter();
    this.removeAllMarkers();
    this.text = '';
    this.current = 0;
    this.total = 0;
  }
  markAll(words) {
    this.removeHighlighter();
    this.removeAllMarkers();
    
    words = words.filter(word => !!word);
    if (words.length == 0) {
      return 0;
    }
    
    const regex = this.createRegExpFromWords(words);
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const nodeList = new Map();
    let index = 0;
    let textContents = '';
    while(walker.nextNode()) {
      const elementName = walker.currentNode.parentNode.tagName;
      if (skipElementNames.indexOf(elementName) >= 0) {
        continue;
      }
      
      nodeList.set(index, walker.currentNode);
      let textContent = walker.currentNode.textContent;
      textContents += textContent
      index += textContent.length
    }
    if (nodeList.size === 0) {
      return 0;
    }
    
    const nodeListKeys = Array.from(nodeList.keys());
    function findKeyFromTextIndex(index) {
      let keyIndex = nodeListKeys.findIndex(k => k > index);
      if (!keyIndex) {
        keyIndex = nodeListKeys.length;
      }
      return nodeListKeys[keyIndex - 1];
    }
    function createRangeFromTextIndex(index) {
      const nodeIndex = findKeyFromTextIndex(index);
      const node = nodeList.get(nodeIndex);
      
      const range = document.createRange();
      const indexInNode = index - nodeIndex;
      range.setStart(node, indexInNode);
      range.setEnd(node, indexInNode);
      return range;
    }
    
    const rangePairs = [];
    let result;
    while ((result = regex.exec(textContents)) !== null) {
      rangePairs.push([
        createRangeFromTextIndex(result.index),
        createRangeFromTextIndex(result.index + result[0].length)
      ]);
    }
    
    rangePairs.forEach((rangePair, i) => {
      ['start', 'end'].forEach((type, j) => {
        const markElementName = `${elementName}-${type}`;
        const markElement = document.createElement(markElementName);
        markElement.dataset.id = i;
        
        const range = rangePair[j];
        range.insertNode(markElement);
        range.detach();
      });
    });
    
    nodeList.clear();
    return rangePairs.length;
  }
  createRegExpFromWords(words) {
    let source = words
      .map(word => {
        if (!(/^[a-zA-Z0-9]$/.test(word))) {
          // 英単語以外のキーワードでは、途中にホワイトスペースが入っててもマッチさせる
          return word.split('').map((chr) => {
            return escapeStringRegexp(chr);
          }).join('\\s*');
        }
        return escapeStringRegexp(word);
      })
      .join('|');
    return new RegExp(source, 'gi');
  }
  addHighlighter(id) {
    const markerPair = ['start', 'end'].map(type => {
      return document.querySelector(
        `${elementName}-${type}[data-id="${id}"]`
      )
    });
    this.highlighter = new Highlighter(markerPair);
    this.highlighter.once('did-change-rect', this.scrollToRect.bind(this));
    this.highlighter.on('did-change-rect', rect => {
      this.emit('did-change-highlight', {
        rect: rect,
        offset: {
          x: window.pageXOffset,
          y: window.pageYOffset
        }
      });
    });
  }
  removeHighlighter() {
    if (this.highlighter) {
      this.highlighter.destroy();
    }
    this.highlighter = null;
  }
  scrollToRect(rect) {
    let targetY = 0;
    let targetX = 0;
    let pageH = window.innerHeight;
    let pageW = window.innerWidth;
    let scrollX = window.pageXOffset;
    let scrollY = window.pageYOffset;
    let barSize = pageW - document.body.clientWidth;
    
    if (rect.top >= 0 && rect.bottom <= pageH - barSize) {
      targetY = scrollY;
    } else if (rect.height > pageH) {
      targetY = scrollY + rect.top;
    } else {
      targetY = scrollY + (rect.top + rect.height / 2) - (pageH / 2) + barSize;
    }
    
    if (rect.left >= 0 && rect.right <= pageW - barSize) {
      targetX = scrollX;
    } else if (rect.left < 0) {
      targetX = scrollX + rect.left;
    } else if (rect.right > pageW - barSize) {
      if (rect.width > pageW - barSize) {
        targetX = scrollX + rect.left;
      } else {
        targetX = scrollX + (rect.right - pageW + barSize);
      }
    }
    window.scrollTo(targetX, targetY);
  }
  removeAllMarkers() {
    ['start', 'end'].forEach((type) => {
      let tagName = `${elementName}-${type}`;
      let markers = document.getElementsByTagName(tagName);
      while(markers.length) {
        markers[0].parentNode.removeChild(markers[0]);
      }
    });
  }
}

module.exports = FindInPage;
