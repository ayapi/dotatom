"use babel";

atom.commands.add('atom-workspace', 'custom:split-right-and-new-editor', () => {
	let pane = atom.workspace.getActivePane();
	pane.splitRight();
	atom.workspace.open();
});

atom.commands.add('atom-workspace', 'custom:split-bottom-and-new-editor', () => {
	let pane = atom.workspace.getActivePane();
	pane.splitDown();
	atom.workspace.open();
});

function swap (direction) {
	let fromPane = atom.workspace.getActivePane();
	let fromItem = fromPane.getActiveItem();
	this[`focusPaneView${direction}`]();
	let toPane = atom.workspace.getActivePane();
	
	console.log(fromPane.id, toPane.id);
	if (fromPane.id === toPane.id) {
		return;
	}
	let toItem = toPane.getActiveItem();
	
	if (toPane.getItems().length === 0) {
		toPane.addItem(atom.workspace.buildTextEditor());
	}
	if (fromPange.getItems().length === 0) {
		fromPane.addItem(atom.workspace.buildTextEditor());
	}
	
	toPane.moveItemToPane(toItem, fromPane, 0);
	fromPane.moveItemToPane(fromItem, toPane, 0);
	
	toPane.activateItem(fromItem);
	toPane.destroyInactiveItems();
	fromPane.activateItem(toItem);
	fromPane.destroyInactiveItems();
}

atom.commands.add('atom-workspace', 'custom:swap-right', function () {
	swap.call(this, 'OnRight');
});
atom.commands.add('atom-workspace', 'custom:swap-left', function () {
	swap.call(this, 'OnLeft');
});
atom.commands.add('atom-workspace', 'custom:swap-up', function () {
	swap.call(this, 'Above');
});
atom.commands.add('atom-workspace', 'custom:swap-down', function () {
	swap.call(this, 'Below');
});