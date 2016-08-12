"use babel";

atom.workspace.onDidOpen((ev) => {
  ev.pane.destroyInactiveItems();
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
	this[`focusPaneView${direction}`]();
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

atom.commands.add('atom-workspace', 'custom:swap-pane-with-right', function () {
	swapPane.call(this, 'OnRight');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-left', function () {
	swapPane.call(this, 'OnLeft');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-up', function () {
	swapPane.call(this, 'Above');
});
atom.commands.add('atom-workspace', 'custom:swap-pane-with-down', function () {
	swapPane.call(this, 'Below');
});

function movePane (direction) {
  let fromPane = atom.workspace.getActivePane();
	let fromItem = fromPane.getActiveItem();
	this[`focusPaneView${direction}`]();
  let collisionPane = atom.workspace.getActivePane();
  
  if (fromPane.id === collisionPane.id) {
		return;
	}
	
  collisionPane.splitDown();
  let toPane = atom.workspace.getActivePane();
  fromPane.moveItemToPane(fromItem, toPane, 0);
}

atom.commands.add('atom-workspace', 'custom:move-pane-to-right', function () {
	movePane.call(this, 'OnRight');
});
atom.commands.add('atom-workspace', 'custom:move-pane-to-left', function () {
	movePane.call(this, 'OnLeft');
});