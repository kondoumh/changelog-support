const vscode = require("vscode");
const dayjs = require("dayjs");

const getConfiguration = () => vscode.workspace.getConfiguration("changelog");
const headlinePattern = /^\d{4}-\d{2}-\d{2}(?:\s+\S+)?\s+<[^>]+>\s*$/;

const createHeadline = (date, configuration) => {
  const config = configuration || getConfiguration();
  const mailAddress = config.mailAddress;

  if (config.dayOfWeekLang === "ja") {
    dayjs.locale('ja', {weekdaysShort: ["日", "月", "火", "水", "木", "金", "土"]});
  } else if (config.dayOfWeekLang === "none") {
    dayjs.locale("en");
  } else {
    dayjs.locale('en');
  }

  const now = dayjs(date);
  const today = now.format("YYYY-MM-DD");
  if (config.dayOfWeekLang === "none") {
    return `${today}  <${mailAddress}>`;
  }

  return `${today} ${now.format("ddd")}  <${mailAddress}>`;
};

const createTemplate = (date, configuration) => {
  const config = configuration || getConfiguration();
  let items;
  if (date.getDay() > 0 && date.getDay() < 6) {
    items = config.weekdayItems;
  } else {
    items = config.weekendItems;
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

const createOutlineSymbols = (document, showBulletItems) => {
  const sectionSymbols = [];
  const bulletPattern = /^\s*\*\s+([^:]+)(?::\s*(.*))?$/;
  let currentSection = null;
  let currentSectionHasSummary = false;
  let currentSectionHasBullet = false;

  for (let line = 0; line < document.lineCount; line += 1) {
    const lineText = document.lineAt(line).text;
    const trimmed = lineText.trim();
    const lineRange = document.lineAt(line).range;

    if (headlinePattern.test(trimmed)) {
      currentSection = new vscode.DocumentSymbol(
        trimmed,
        "",
        vscode.SymbolKind.Namespace,
        lineRange,
        lineRange
      );
      currentSection.children = [];
      currentSectionHasSummary = false;
      currentSectionHasBullet = false;
      sectionSymbols.push(currentSection);
      continue;
    }

    if (!currentSection) {
      continue;
    }

    currentSection.range = new vscode.Range(
      currentSection.range.start,
      lineRange.end
    );

    if (!trimmed) {
      continue;
    }

    const bulletMatch = lineText.match(bulletPattern);
    if (bulletMatch) {
      currentSectionHasBullet = true;
      if (!showBulletItems) {
        continue;
      }
      const tag = bulletMatch[1].trim();
      const detail = bulletMatch[2] ? bulletMatch[2].trim() : "";
      currentSection.children.push(
        new vscode.DocumentSymbol(
          tag,
          detail,
          vscode.SymbolKind.Field,
          lineRange,
          lineRange
        )
      );
      continue;
    }

    if (!currentSectionHasSummary && !currentSectionHasBullet) {
      currentSection.children.push(
        new vscode.DocumentSymbol(
          trimmed,
          "",
          vscode.SymbolKind.String,
          lineRange,
          lineRange
        )
      );
      currentSectionHasSummary = true;
    }
  }

  return sectionSymbols;
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
      const config = getConfiguration();
      const headline = createHeadline(date, config);
      const templ = createTemplate(date, config);
      let selection = editor.selection;
      editor.edit(editorEdit => {
        editorEdit.replace(selection, "");
        editorEdit.insert(selection.active, headline + templ);
      });
    }
  );
  context.subscriptions.push(disposable);

  const symbolProvider = vscode.languages.registerDocumentSymbolProvider(
    { language: "changelog" },
    {
      provideDocumentSymbols(document) {
        const showBulletItems = getConfiguration().outlineShowBulletItems !== false;
        return createOutlineSymbols(document, showBulletItems);
      }
    }
  );
  context.subscriptions.push(symbolProvider);
}
exports.activate = activate;

// this method is called when extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
