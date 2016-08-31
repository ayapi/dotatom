import assert from 'power-assert';
import http from 'http';
import {attachToDOM, domReadyPromise} from './helper';

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
  
  describe('webview', () => {
    it('should receive focus correctly', async () => {
      let panes = [];
      let items = [];
      panes[0] = atom.workspace.getActivePane();
      panes[1] = panes[0].splitDown();
      panes[2] = panes[1].splitDown();
      
      panes[1].activate();
      items[0] = await atom.workspace.open(HTTP_URL + '0');
      items[1] = await atom.workspace.open(HTTP_URL + '1');
      
      panes[2].activate();
      items[2] = await atom.workspace.open(); // empty text-editor
      
      // pane0|   (empty pane)
      // -----------------------
      // pane1| (tab) wv0 | wv1
      //      |    wv1 content
      // -----------------------
      // pane2|    text editor
      
      // now activeElement is text-editor on pane2
      assert(document.activeElement != items[1].webview);
      
      panes[1].activate();
      assert(document.activeElement == items[1].webview);
      
      panes[1].activateItem(items[0]);
      assert(document.activeElement == items[0].webview);
      
      panes[1].activateItem(items[1]);
      assert(document.activeElement == items[1].webview);
      
      panes[0].activate();
      assert(document.activeElement != items[1].webview);
      
      panes[1].activate();
      assert(document.activeElement == items[1].webview);
      
      panes[2].activate();
      assert(document.activeElement != items[1].webview);
      
      panes[1].activate();
      panes[1].activateItem(items[0]);
      assert(document.activeElement == items[0].webview);
      
      panes.forEach((pane) => {
        pane.destroyItems();
        pane.destroy();
      });
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
      
      let item = atom.workspace.getActivePaneItem(); // = text-editor
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
      
      item = atom.workspace.getActivePaneItem();
      assert(item.getURL() == HTTP_URL + 'new1');
      assert(document.activeElement === item.webview);
      
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
      assert(document.activeElement === ev.item.webview);
      
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
      assert(document.activeElement === ev.item.webview);
      
      let panel = atom.workspace.panelForItem(editorElement.getModel());
      assert(!panel.isVisible());
    });
  });
});