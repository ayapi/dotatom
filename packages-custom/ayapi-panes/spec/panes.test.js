import assert from 'power-assert';
import {attachToDOM, domReadyPromise} from './helper';

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, ms);
  });
}

describe('main', function () {
  this.timeout(10000);
  let workspaceElement;
  let panes;
  
  before(async () => {
    workspaceElement = atom.views.getView(atom.workspace);
    attachToDOM(workspaceElement);
    workspaceElement.style.height = '100px';
  });
  
  beforeEach(async () => {
    panes = [];
    await atom.packages.activatePackage('ayapi-panes');
  });
  
  afterEach(async () => {
    panes.forEach((pane) => {
      pane.destroy();
    });
    panes = [];
    await atom.packages.deactivatePackage('ayapi-panes');
  });
  
  describe('focusPane', () => {
    describe('focus-pane-below', () => {
      it('should focus text-editor', async () => {
        let items = [];
        panes[0] = atom.workspace.getActivePane();
        items[0] = await atom.workspace.open();
        
        panes[1] = panes[0].splitDown();
        panes[1].activate();
        items[1] = await atom.workspace.open();
        
        panes[0].activate();
        
        atom.commands.dispatch(
          atom.views.getView(items[0]),
          'ayapi-panes:focus-pane-below'
        );
        
        assert(document.activeElement == atom.views.getView(items[1]));
      });
      it('should focus text-editor have wider gutter', async () => {
        let items = [];
        panes[0] = atom.workspace.getActivePane();
        items[0] = await atom.workspace.open();
        
        panes[1] = panes[0].splitDown();
        panes[1].activate();
        items[1] = await atom.workspace.open();
        items[1].insertText('\n'.repeat(10000));
        
        panes[0].activate();
        atom.commands.dispatch(
          atom.views.getView(items[0]),
          'ayapi-panes:focus-pane-below'
        );
        
        assert(document.activeElement == atom.views.getView(items[1]));
        items[1].undo();
      });
    });
  });
});
