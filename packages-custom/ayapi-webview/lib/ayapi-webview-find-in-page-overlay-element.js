'use babel';

class AyapiWebviewFindInPageOverlayElement extends HTMLElement {
  get visible() {
    return this._visible;
  }
  set visible(value) {
    this._visible = value;
    this.style.display = value ? null : 'none';
  }
  constructor() {
    super();
    this._visible = false;
  }
  initialize() {
  }
  createdCallback() {
    this.hide();
  }
  update({rect, offset}) {
    console.log(rect,offset);
    if (!rect) return;
    this.style.top = Math.max(0, rect.top + offset.y) - offset.y + 'px';
    this.style.left = Math.max(0, rect.left + offset.x) - offset.x + 'px';
    this.style.width = Math.max(10, rect.width) + 'px';
    this.style.height = Math.max(10, rect.height) + 'px';
  }
  hide() {
    this.visible = false;
  }
  show() {
    this.visible = true;
  }
}

module.exports = AyapiWebviewFindInPageOverlayElement = document.registerElement(
  'ayapi-webview-find-in-page-overlay',
  {prototype: AyapiWebviewFindInPageOverlayElement.prototype}
)
