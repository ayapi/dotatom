"use babel";

atom.workspace.onDidOpen((ev) => {
  ev.pane.destroyInactiveItems();
});

function moveModalPanel(panel) {
  let activePane = atom.workspace.getActivePane();
  let activePaneElement = atom.views.getView(activePane);
  let rect = activePaneElement.getBoundingClientRect();
  let panelElement = atom.views.getView(panel);
  panelElement.style.top = Math.floor(rect.top) + 'px';
  panelElement.style.left = Math.floor(rect.left) + 'px';
  panelElement.style.width = Math.floor(rect.width) + 'px';
}

atom.workspace.panelContainers.modal.onDidAddPanel((params) => {
  let {panel} = params;
  if (panel.isVisible()) {
    moveModalPanel(panel);
  }
  panel.onDidChangeVisible((visible) => {
    if (visible) {
      moveModalPanel(panel);
    }
  });
});

function scroll(amount) {
  let pane = atom.workspace.getActivePane();
  if (!pane) {
    return;
  }
  let item = pane.getActiveItem();
  if (!item) {
    return;
  }
  item.setScrollTop(item.getScrollTop() + item.getLineHeightInPixels() * amount);
}

atom.commands.add('atom-pane', 'custom:scroll-down', () => {
  scroll(3);
});
atom.commands.add('atom-pane', 'custom:scroll-up', () => {
  scroll(-3);
});

atom.commands.add('atom-workspace', 'custom:split-right-and-new-editor', () => {
	let pane = atom.workspace.getActivePane();
	pane.splitRight();
	atom.workspace.open();
});

atom.commands.add('atom-workspace', 'custom:split-down-and-new-editor', () => {
	let pane = atom.workspace.getActivePane();
	pane.splitDown();
	atom.workspace.open();
});

function swapPane (direction) {
	let fromPane = atom.workspace.getActivePane();
	let fromItem = fromPane.getActiveItem();
	document.querySelector('atom-workspace')[`focusPaneView${direction}`]();
	let toPane = atom.workspace.getActivePane();
	
	console.log(fromPane.id, toPane.id);
	if (fromPane.id === toPane.id) {
		return;
	}
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
}

atom.commands.add('atom-workspace', 'custom:swap-pane-with-right', () => {
	swapPane('OnRight');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-left', () => {
	swapPane('OnLeft')
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-up', () => {
	swapPane('Above');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-down', () => {
	swapPane('Below');
});

function movePane (direction) {
  let fromPane = atom.workspace.getActivePane();
	let fromItem = fromPane.getActiveItem();
	document.querySelector('atom-workspace')[`focusPaneView${direction}`]();
  let collisionPane = atom.workspace.getActivePane();
  
  if (fromPane.id === collisionPane.id) {
		return;
	}
	
  collisionPane.splitDown();
  let toPane = atom.workspace.getActivePane();
  fromPane.moveItemToPane(fromItem, toPane, 0);
}

atom.commands.add('atom-workspace', 'custom:move-pane-to-right', () => {
	movePane('OnRight');
});
atom.commands.add('atom-workspace', 'custom:move-pane-to-left', () => {
	movePane('OnLeft');
});

