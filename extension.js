const vscode = require("vscode");

function getFormatedDate(date, format) {
  format = format.replace(/YYYY/g, date.getFullYear());
  format = format.replace(/MM/g, ("0" + (date.getMonth() + 1)).slice(-2));
  format = format.replace(/DD/g, ("0" + date.getDate()).slice(-2));
  format = format.replace(
    /WW/g,
    ["日", "月", "火", "水", "木", "金", "土"][date.getDay()]
  );
  return format;
}

// this method is called when the extension is activated
function activate(context) {
  console.log("changelog-support is now active!");

  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "extension.insertItem",
    () => {
      // The code placed here will be executed every time command is executed
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const headline =
        getFormatedDate(new Date(), "YYYY-MM-DD WW") + "  <kondoh@local>";
      let selection = editor.selection;

      editor.edit(editorEdit => {
        editorEdit.replace(selection, "");
        editorEdit.insert(selection.active, headline);
      });
    }
  );

  context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
