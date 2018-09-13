const vscode = require("vscode");
const moment = require("moment");

const getConfiguration = () => vscode.workspace.getConfiguration("changelog");

const createHeadline = (date) => {
  const mailAddress = getConfiguration().mailAddress;
  
  if (getConfiguration().dayOfWeekLang === "ja") {
    moment.locale('ja', {weekdaysShort: ["日", "月", "火", "水", "木", "金", "土"]});
  } else {
    moment.locale('en');
  }

  const now = moment(date);
  const today =now.format("YYYY-MM-DD");
  const dayOfWeek = now.format("ddd");
  return `${today} ${dayOfWeek}  <${mailAddress}>`;
};

const createTemplate = (date) => {
  let items;
  if (date.getDay() > 0 && date.getDay() < 6) {
    items = getConfiguration().weekdayItems;
  } else {
    items = getConfiguration().weekendItems;
  }
  if (items.length == 0) {
    return "";
  }
  let templ = "\n\n";
  items.forEach(item => {
    if (item[0] == '-') {
      templ += `\t${item}\n`;
    } else {
      templ += `\t* ${item}:\n`;
    }
  });
  return templ;
};

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
      const date = new Date();
      const headline = createHeadline(date);
      const templ = createTemplate(date);
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
