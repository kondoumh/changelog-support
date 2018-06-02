// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "changelog-support" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "extension.insertItem",
    function() {
      // The code you place here will be executed every time your command is executed

      // Display a message box to the user
      var editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      var headline =
        getFormatedDate(new Date(), "YYYY-MM-DD WW") + "  <kondoh@local>";
      var selection = editor.selection;

      editor.edit(editorEdit => {
        editorEdit.replace(selection, "");
        editorEdit.insert(selection.active, headline);
      });
    }
  );

  context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
