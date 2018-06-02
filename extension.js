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

function isWeekDay(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek > 0 && dayOfWeek < 6;
}

function createHeadline() {
  const mailaddress = vscode.workspace.getConfiguration("changelog")
    .mailaddress;
  const headline =
    getFormatedDate(new Date(), "YYYY-MM-DD WW") + "  <" + mailaddress + ">";
  return headline;
}

function createTemplate() {
  const date = new Date();
  let items;
  if (isWeekDay(date)) {
    items = vscode.workspace.getConfiguration("changelog").weekdayitems;
  } else {
    items = vscode.workspace.getConfiguration("changelog").weekenditems;
  }
  let templ = "\n\n";
  items.forEach(item => {
    templ += `\t* ${item}:\n`;
  });
  return templ;
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
      const headline = createHeadline();
      const templ = createTemplate();
      let selection = editor.selection;
      editor.edit(editorEdit => {
        editorEdit.replace(selection, "");
        editorEdit.insert(selection.active, headline + templ);
      });
    }
  );
  context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
