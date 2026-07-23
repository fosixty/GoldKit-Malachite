function createTextContextMenuTemplate(editFlags = {}) {
  return [
    { role: 'undo', enabled: Boolean(editFlags.canUndo) },
    { role: 'redo', enabled: Boolean(editFlags.canRedo) },
    { type: 'separator' },
    { role: 'cut', enabled: Boolean(editFlags.canCut) },
    { role: 'copy', enabled: Boolean(editFlags.canCopy) },
    { role: 'paste', enabled: Boolean(editFlags.canPaste) },
    { type: 'separator' },
    { role: 'selectAll', enabled: Boolean(editFlags.canSelectAll) },
  ];
}

module.exports = { createTextContextMenuTemplate };
