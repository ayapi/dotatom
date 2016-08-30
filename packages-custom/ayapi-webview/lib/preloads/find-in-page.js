"use strict";

const {ipcRenderer} = require('electron');
const cloneRegexp = require('clone-regexp');
const escapeStringRegexp = require('escape-string-regexp');

document.addEventListener('DOMContentLoaded', function(event) {
  if (location.protocol == 'about:') {
    return;
  }
  
  let elementName = "ayapiwebviewfind";
  let attrName = "ayapi-webview-find";
  let attrCamelName = "ayapiWebviewFind";
  let classname = "ayapi-webview-find";
  let classnameForCurrent = classname + '-current';
  let classnameForParent = classname + '-parent';
  let classnameForAncestors = classname + '-ancestor';
  let classnameForOverlay = classname + '-overlay';
  
  document.registerElement(`${elementName}-highlight`, {
    extends: 'span',
    prototype: Object.create(HTMLSpanElement.prototype)
  });
  document.registerElement(`${elementName}-overlay-base`, {
    extends: 'div',
    prototype: Object.create(HTMLDivElement.prototype)
  });
  document.registerElement(`${elementName}-overlay`, {
    extends: 'div',
    prototype: Object.create(HTMLDivElement.prototype)
  });
  document.getElementsByTagName('html')[0].appendChild(
    document.createElement(`${elementName}-overlay-base`)
  );
  
  let style = document.createElement("style");
  style.appendChild(document.createTextNode(""));	// WebKit hack @@
  document.head.appendChild(style);
  let sheet = style.sheet;
  
  [
    `.${classname} {background: #0FF !important; color: #000 !important; padding:0 !important;}`,
    `.${classname} * {background: #FF0 !important; color: #000 !important; padding:0 !important;}`,
    `.${classname}::selection {background: rgba(0,0,0,0.01) !important; color: #000 !important;}`,
    `.${classnameForCurrent} {background: #FF0 !important; color: #000 !important; padding:0 !important;}`,
    `.${classnameForCurrent} * {background: #FF0 !important; color: #000 !important; padding:0 !important;}`,
    `${elementName}-overlay-base {position:absolute !important; z-index: 99999999 !important; top: 0; left: 0; pointer-events: none !important; background: transparent !important;}`,
    `${elementName}-overlay {pointer-events: none !important; box-sizing:content-box !important; position:absolute !important; background: rgba(255,255,0, .3) !important; outline: 2px dotted #FF0	!important; box-shadow: 0 0 0 2px rgba(128,128,128,.5) !important;}`
  ].forEach((rule, i) => {
    sheet.insertRule(rule, i);
  });
  
  let followTimer;
  
  function enableHighlight(ev, words) {
    disableHighlight();
    
    let ranges = [];
    
    words.forEach((word) => {
      if (/^\s+$/.test(word)) {
        return;
      }
      if (!(/^[a-zA-Z]$/.test(word))) {
        // 英単語以外のキーワードでは、途中にホワイトスペースが入っててもマッチさせる
        word = word.split('').map((chr) => {
          return escapeStringRegexp(chr);
        }).join('\\s*');
      } else {
        word = escapeStringRegexp(word);
      }
      
      var wordRegex = new RegExp(word, "gi");
      var treeWalker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              function check (node) {
                if (cloneRegexp(wordRegex).test(node.nodeValue)) {
                  return NodeFilter.FILTER_ACCEPT;
                } else {
                  return NodeFilter.FILTER_SKIP;
                }
              }
              return check(node);
            }
          },
          false);

      // get textnode
      var skipTagName = {
        "NOSCRIPT": true,
        "SCRIPT": true,
        "STYLE": true
      };
      var nodeList = [];
      while(treeWalker.nextNode()) {
        if (!skipTagName[treeWalker.currentNode.parentNode.tagName]) {
          nodeList.push(treeWalker.currentNode);
        }
      }
      
      // highlight all filtered textnode
      nodeList.forEach(function (n) {
        let regex = cloneRegexp(wordRegex);
        let result;
        while ((result = regex.exec(n.textContent)) !== null) {
          var wordRange = document.createRange();
          wordRange.setStart(n, result.index);
          wordRange.setEnd(n, result.index + result[0].length);
          ranges.push(wordRange);
        }
      });
    });
    
    // highlight all ranges
    ranges.forEach((range, i) => {
      let span = document.createElement(`${elementName}-highlight`);
      span.className = classname;
      span.classList.add(classname);
      span.dataset[`${attrCamelName}Id`] = i;

      span.appendChild(range.extractContents());
      range.insertNode(span);
    });
    
    return ranges.length;
  }
  
  function disableHighlight(ev) {
    removeOverlays();
    let oldTree = document.getElementsByTagName(`${elementName}-highlight`);
    while(oldTree.length) {
      oldTree[0].outerHTML = oldTree[0].innerHTML
    }
  }
  
  function removeOverlays() {
    let oldOverlays = document.getElementsByTagName(`${elementName}-overlay`);
    for(let i = oldOverlays.length; i--;) {
      oldOverlays[i].parentNode.removeChild(oldOverlays[i]);
    }
  }
  
  let text = '';
  let current = 0;
  let total = 0;
  ipcRenderer.on('find', (ev, options) => {
    if (options.text !== text) {
      total = enableHighlight(ev, options.text.split(' '));
      text = options.text;
      scrollToHighlight(0);
      ipcRenderer.sendToHost('found', {current: 1, total: total});
    } else {
      current += options.direction;
      if (current > total - 1) {
        current = 0;
      }
      if (current < 0) {
        current = total - 1;
      }
      scrollToHighlight(current);
      ipcRenderer.sendToHost('found', {current: current + 1, total: total});
    }
  });
  
  ipcRenderer.on('clearFound', () => {
    disableHighlight();
    text = '';
    current = 0;
    total = 0;
  });

  function scrollToHighlight(i) {
    removeOverlays();
    
    let oldCurrents = document.getElementsByClassName(classnameForCurrent);
    while(oldCurrents.length) {
      oldCurrents[0].classList.remove(classnameForCurrent);
    }
    
    let highlights = document.getElementsByClassName(classname);
    let targetElement = highlights[i];
    
    targetElement.classList.add(classnameForCurrent);
    selectElement(targetElement);
    
    let overlay = document.createElement(`${elementName}-overlay`);
    let overlayBase = document.getElementsByTagName(`${elementName}-overlay-base`)[0];
    overlayBase.appendChild(overlay);
    followTarget(overlay, targetElement);
    
    let rect = getRect(targetElement);
    if (!rect) {
      return;
    }
    
    let targetY = 0;
    let targetX = 0;
    let pageH = window.innerHeight;
    let pageW = window.innerWidth;
    let barSize = 20;
    
    if (rect.top >= 0 && rect.bottom <= pageH	- barSize ) {
      targetY = window.pageYOffset;
    } else if (rect.height > pageH) {
      targetY = window.pageYOffset + rect.top;
    } else {
      targetY = window.pageYOffset + (rect.top + rect.height / 2) - (pageH / 2) + barSize;
    }
    
    if (rect.left >= 0 && rect.right <= pageW - barSize ) {
      targetX = window.pageXOffset;
    } else if (rect.left < 0) {
      targetX = window.pageXOffset + rect.left;
    } else if (rect.right > pageW	- barSize) {
      if (rect.width > pageW - barSize) {
        targetX = window.pageXOffset + rect.left;
      } else {
        targetX = window.pageXOffset + (rect.right - pageW + barSize);
      }
    }
    window.scrollTo(targetX, targetY);
  }
  
  function selectElement(targetElement) {
    let selection = window.getSelection();
    selection.removeAllRanges();
    let range = document.createRange();
    range.selectNode(targetElement);
    selection.addRange(range);
  }
  
  function getRect(targetEl) {
    let rect;
    while(!rect) {
      let rects = [... targetEl.getClientRects()];
      if (rects.length > 0) {
        rect = rects.find((rect) => {
          return rect.width != 0 && rect.height != 0;
        }) || rects[0];
      }
      if (!rect) {
        if (targetEl.parentNode.nodeType != 1) { // documentとかまで到達した
          break;
        }
        targetEl = targetEl.parentNode;
      }
    }
    return rect;
  }
  
  function followTarget(overlay, targetEl) {
    clearInterval(followTimer);
    followTimer = setInterval(() => {
      try {
        let rect = getRect(targetEl);
        if (!rect) {
          return;
        }
        overlay.style.top = Math.max(0, rect.top + window.pageYOffset) + 'px';
        overlay.style.left = Math.max(0, rect.left + window.pageXOffset) + 'px';
        overlay.style.width = Math.max(10, rect.width) + 'px';
        overlay.style.height = Math.max(10, rect.height) + 'px';
      } catch(err) {
        // エラーでたら無視
      }
    }, 80);
  }
});
