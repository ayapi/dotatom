import assert from 'power-assert';
import http from 'http';

function attachToDOM(element) {
  let specContent = document.querySelector('#spec-content');
  if (!specContent) {
    specContent = document.createElement('div');
    specContent.id = 'spec-content';
    document.body.appendChild(specContent);
  }
  if (!specContent.contains(element)) {
    return specContent.appendChild(element);
  }
};

function domReadyPromise(webviewElement) {
  return new Promise((resolve) => {
    let disposable = webviewElement.onDomReady((url) => {
      if (url === 'about:blank') return;
      disposable.dispose();
      resolve(url);
    });
  });
}

describe('main', function () {
  this.timeout(10000);
  let workspaceElement;
  let server;
  const HTTP_PORT = 3333;
  const HTTP_URL = `http://localhost:${HTTP_PORT}/`;
  
  beforeEach(async () => {
    server = http.createServer().listen(HTTP_PORT)
    require('server-destroy')(server);
    server.timeout = 0;
    server.on('request', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Connection': 'close'
      });
      res.end('<html>example</html>');
    });
    workspaceElement = atom.views.getView(atom.workspace);
    attachToDOM(workspaceElement);
    await atom.packages.activatePackage('ayapi-webview');
  });
  
  afterEach(async () => {
    await atom.packages.deactivatePackage('ayapi-webview');
    server.destroy();
  });
  
  describe('opener', () => {
    it('should open item to current pane with `http` protocol', async () => {
      let pane = atom.workspace.getActivePane();
      assert(pane.getItems().length === 0);
      
      await atom.workspace.open(HTTP_URL);
      assert(pane.getItems().length === 1);
      
      let item = pane.getActiveItem();
      assert(item.constructor.name == 'ayapi-webview');
      assert(item.getURL() === HTTP_URL);
    });
  });
  
  describe('modal address editor', () => {
    it('is opened from empty pane', async () => {
      assert(workspaceElement.querySelector('.ayapi-webview-address') === null);
      atom.commands.dispatch(workspaceElement, 'ayapi-webview:input-address');
      
      let editorElement = workspaceElement.querySelector('.ayapi-webview-address');
      assert(editorElement);
      
      let panel = atom.workspace.panelForItem(editorElement.getModel());
      assert(panel.isVisible());
      
      assert(editorElement.hasFocus());
      assert(editorElement.getModel().getText() == '');
    });
    it('is opened from webview', async () => {
      await atom.workspace.open(HTTP_URL);
      let item = atom.workspace.getActivePaneItem();
      assert(item.getURL() === HTTP_URL);
      
      atom.commands.dispatch(workspaceElement, 'ayapi-webview:input-address');
      
      let editorElement = workspaceElement.querySelector('.ayapi-webview-address');
      assert(editorElement);
      
      let panel = atom.workspace.panelForItem(editorElement.getModel());
      assert(panel.isVisible());
      
      assert(editorElement.hasFocus());
      assert(editorElement.getModel().getText() == HTTP_URL);
    });
    it('is closed by blur', async () => {
      atom.commands.dispatch(workspaceElement, 'ayapi-webview:input-address');
      
      let editorElement = workspaceElement.querySelector('.ayapi-webview-address');
      assert(editorElement);
      assert(editorElement.hasFocus());
      
      editorElement.blur();
      
      let panel = atom.workspace.panelForItem(editorElement.getModel());
      assert(!panel.isVisible());
    });
    it('is closed by `core:cancel` cmd', async () => {
      atom.commands.dispatch(workspaceElement, 'ayapi-webview:input-address');
      
      let editorElement = workspaceElement.querySelector('.ayapi-webview-address');
      assert(editorElement);
      assert(editorElement.hasFocus());
      
      atom.commands.dispatch(editorElement, 'core:cancel');
      
      let panel = atom.workspace.panelForItem(editorElement.getModel());
      assert(!panel.isVisible());
    });
    it('restore focus after close', async () => {
      // create empty text editor
      await atom.workspace.open();
      
      atom.commands.dispatch(workspaceElement, 'ayapi-webview:input-address');
      
      let editorElement = workspaceElement.querySelector('.ayapi-webview-address');
      assert(editorElement.hasFocus());
      
      atom.commands.dispatch(editorElement, 'core:cancel');
      
      let item = atom.workspace.getActivePaneItem();
      assert(atom.views.getView(item).hasFocus());
      
      atom.workspace.paneForItem(item).destroyItem(item);
    });
    it('load new url by `load` cmd on webview', async () => {
      await atom.workspace.open(HTTP_URL + 'old1');
      
      let pane = atom.workspace.getActivePane();
      assert(pane.getItems().length === 1);
      
      let item = atom.workspace.getActivePaneItem();
      await domReadyPromise(item);
      
      atom.commands.dispatch(workspaceElement, 'ayapi-webview:input-address');
      
      let editorElement = workspaceElement.querySelector('.ayapi-webview-address');
      editorElement.getModel().setText(HTTP_URL + 'new1');
      
      atom.commands.dispatch(editorElement, 'ayapi-webview:load');
      await domReadyPromise(item);
      
      assert(pane.getItems().length === 1);
      assert(atom.workspace.getActivePaneItem().getURL() == HTTP_URL + 'new1');
      
      let panel = atom.workspace.panelForItem(editorElement.getModel());
      assert(!panel.isVisible());
    });
    it('open new webview to active pane by `load` cmd on excluding webview', async () => {
      // create empty text editor
      await atom.workspace.open();
      
      let pane = atom.workspace.getActivePane();
      assert(pane.getItems().length === 1);
      
      let item = atom.workspace.getActivePaneItem();
      
      atom.commands.dispatch(workspaceElement, 'ayapi-webview:input-address');
      
      let editorElement = workspaceElement.querySelector('.ayapi-webview-address');
      editorElement.getModel().setText(HTTP_URL);
      
      let didOpenPromise = new Promise((resolve) => {
        atom.workspace.onDidOpen(ev => resolve(ev));
      });
      atom.commands.dispatch(editorElement, 'ayapi-webview:load');
      let ev = await didOpenPromise;
      await domReadyPromise(ev.item);
      
      assert(ev.pane == pane);
      assert(ev.item.constructor.name == 'ayapi-webview');
      assert(ev.item.getURL() == HTTP_URL);
      assert(pane.getItems().length === 2);
      
      let panel = atom.workspace.panelForItem(editorElement.getModel());
      assert(!panel.isVisible());
      
      pane.destroyItems();
    });
    it('open new webview to active pane by `load-as-new` cmd', async () => {
      await atom.workspace.open(HTTP_URL + 'old');
      
      let pane = atom.workspace.getActivePane();
      assert(pane.getItems().length === 1);
      
      let item = atom.workspace.getActivePaneItem();
      await domReadyPromise(item);
      
      atom.commands.dispatch(workspaceElement, 'ayapi-webview:input-address');
      
      let editorElement = workspaceElement.querySelector('.ayapi-webview-address');
      editorElement.getModel().setText(HTTP_URL + 'new');
      
      let didOpenPromise = new Promise((resolve) => {
        atom.workspace.onDidOpen(ev => resolve(ev));
      });
      atom.commands.dispatch(editorElement, 'ayapi-webview:load-as-new');
      let ev = await didOpenPromise;
      await domReadyPromise(ev.item);
      
      assert(ev.pane == pane);
      assert(ev.item.constructor.name == 'ayapi-webview');
      assert(ev.item.getURL() == HTTP_URL + 'new');
      assert(pane.getItems().length === 2);
      
      let panel = atom.workspace.panelForItem(editorElement.getModel());
      assert(!panel.isVisible());
    });
  });
});