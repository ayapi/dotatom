const EventEmitter = require('events').EventEmitter;
const escapeStringRegexp = require('escape-string-regexp');

const Highlight = require('./Highlight');
const HighlightElement = require('./HighlightElement');

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
        this.addHighlight(0);
      }
    } else {
      this.current += options.direction;
      if (this.current > this.total - 1) {
        this.current = 0;
      }
      if (this.current < 0) {
        this.current = this.total - 1;
      }
      this.removeHighlight();
      this.addHighlight(this.current);
    }
    this.emit('did-find', {total: this.total, current: this.current});
  }
  clear() {
    this.removeHighlight();
    this.removeHighlightElement();
    this.removeStyle();
    this.removeAllMarkers();
    this.text = '';
    this.current = 0;
    this.total = 0;
  }
  markAll(words) {
    this.removeHighlight();
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
  addStyle() {
    if (this.styleElement) {
      return;
    }
    const style = document.createElement('style');
    style.appendChild(document.createTextNode(''));
    document.head.appendChild(style);
    style.sheet.insertRule(
      '::selection {background: rgba(0,0,0,0.01) !important}'
    , 0);
    this.styleElement = style;
  }
  removeStyle() {
    if (!this.styleElement) {
      return;
    }
    this.styleElement.sheet.deleteRule(0);
    this.styleElement.parentNode.removeChild(this.styleElement);
    this.styleElement = null;
  }
  addHighlight(id) {
    const markerPair = ['start', 'end'].map(type => {
      return document.querySelector(
        `${elementName}-${type}[data-id="${id}"]`
      )
    });
    this.highlight = new Highlight(markerPair);
    this.highlight.once('did-change-rects', this.scrollToRect.bind(this));
    
    if (!this.highlightElement) {
      const element = new HighlightElement();
      element.initialize();
      document.getElementsByTagName('html')[0].appendChild(element);
      this.highlightElement = element;
    }
    this.highlightElement.setModel(this.highlight);
    
    this.addStyle();
  }
  removeHighlight() {
    if (this.highlight) {
      this.highlight.destroy();
    }
    this.highlight = null;
  }
  removeHighlightElement() {
    if (this.highlightElement) {
      this.highlightElement.parentNode.removeChild(this.highlightElement);
      this.highlightElement = null;
    }
  }
  scrollToRect(rects) {
    if (rects.length == 0) {
      return;
    }
    const rect = rects.find(rect => {
      return rect.width != 0 && rect.height != 0
    }) || rects[0];
    
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
