const vscode = require("vscode");
const dayjs = require("dayjs");
const path = require("path");

const getConfiguration = () => vscode.workspace.getConfiguration("changelog");
const headlinePattern = /^\d{4}-\d{2}-\d{2}(?:\s+\S+)?\s+<[^>]+>\s*$/;
const bulletLinePattern = /^\s*\*\s+([^\s(:]+)(?:\s*\(([^)]*)\))?/;
const filenameCompletionPattern = /^\s*\*\s+([^\s(:]*)$/;
const tokenCompletionPattern = /^\s*\*\s+([^\s(:]+)\s*\(([^)]*)$/;
const ignoredFilesPattern = "**/{.git,node_modules,dist,build,out,coverage,.vscode-test}/**";

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

const flattenDocumentSymbols = (symbols) => {
  const flat = [];
  if (!symbols || symbols.length === 0) {
    return flat;
  }
  const stack = [...symbols];
  while (stack.length > 0) {
    const current = stack.pop();
    flat.push(current);
    if (current.children && current.children.length > 0) {
      stack.push(...current.children);
    }
  }
  return flat;
};

const findFileUriFromToken = (document, fileToken) => {
  if (!fileToken) {
    return Promise.resolve(null);
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  let workspaceCandidateCheck = Promise.resolve(null);
  if (workspaceFolder && fileToken.includes("/")) {
    const candidate = vscode.Uri.joinPath(workspaceFolder.uri, fileToken);
    workspaceCandidateCheck = vscode.workspace.fs.stat(candidate)
      .then(() => candidate)
      .catch(() => null);
  }

  return workspaceCandidateCheck.then(candidate => {
    if (candidate) {
      return candidate;
    }
    return vscode.workspace.findFiles(
      `**/${fileToken}`,
      ignoredFilesPattern,
      20
    ).then(matches => {
      if (matches.length === 0) {
        return null;
      }

      const exactRelativeMatch = matches.find(uri =>
        vscode.workspace.asRelativePath(uri, false) === fileToken
      );
      if (exactRelativeMatch) {
        return exactRelativeMatch;
      }

      const sameBasename = matches.filter(uri => path.basename(uri.fsPath) === fileToken);
      if (sameBasename.length === 1) {
        return sameBasename[0];
      }

      return matches[0];
    });
  });
};

const findSymbolLocationInFile = (fileUri, symbolName) => {
  if (!symbolName) {
    return Promise.resolve(null);
  }

  return vscode.commands.executeCommand(
    "vscode.executeDocumentSymbolProvider",
    fileUri
  ).then(symbolResults => {
    const symbols = flattenDocumentSymbols(symbolResults || []);
    const exactSymbol = symbols.find(symbol => symbol.name === symbolName);
    if (exactSymbol) {
      return new vscode.Location(fileUri, exactSymbol.selectionRange);
    }

    return vscode.workspace.openTextDocument(fileUri).then(targetDoc => {
      for (let lineIndex = 0; lineIndex < targetDoc.lineCount; lineIndex += 1) {
        const line = targetDoc.lineAt(lineIndex).text;
        const symbolPattern = new RegExp(`\\b${symbolName}\\b`);
        const index = line.search(symbolPattern);
        if (index >= 0) {
          return new vscode.Location(
            fileUri,
            new vscode.Position(lineIndex, index)
          );
        }
      }
      return new vscode.Location(fileUri, new vscode.Position(0, 0));
    });
  });
};

const collectTokenCandidates = (fileUri) => {
  return vscode.commands.executeCommand(
    "vscode.executeDocumentSymbolProvider",
    fileUri
  ).then(symbolResults => {
    const symbols = flattenDocumentSymbols(symbolResults || []);
    const symbolNames = symbols
      .map(symbol => symbol.name)
      .filter(name => !!name && name !== "<anonymous>");
    if (symbolNames.length > 0) {
      return [...new Set(symbolNames)];
    }

    return vscode.workspace.openTextDocument(fileUri).then(targetDoc => {
      const identifierPattern = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
      const names = new Set();
      for (let lineIndex = 0; lineIndex < targetDoc.lineCount; lineIndex += 1) {
        const line = targetDoc.lineAt(lineIndex).text;
        let match = identifierPattern.exec(line);
        while (match) {
          names.add(match[0]);
          if (names.size > 300) {
            break;
          }
          match = identifierPattern.exec(line);
        }
        identifierPattern.lastIndex = 0;
        if (names.size > 300) {
          break;
        }
      }
      return [...names];
    });
  });
};

const createDefinitionProvider = () => ({
  provideDefinition(document, position) {
    const lineText = document.lineAt(position.line).text;
    const bulletMatch = lineText.match(bulletLinePattern);
    if (!bulletMatch) {
      return null;
    }

    const fileToken = bulletMatch[1];
    const token = bulletMatch[2];
    const fileStart = lineText.indexOf(fileToken);
    const fileEnd = fileStart + fileToken.length;
    const isInFilename = position.character >= fileStart && position.character <= fileEnd;

    return findFileUriFromToken(document, fileToken).then(fileUri => {
      if (!fileUri) {
        return null;
      }

      if (isInFilename || !token) {
        return new vscode.Location(fileUri, new vscode.Position(0, 0));
      }

      const tokenStart = lineText.indexOf(token, fileEnd);
      const tokenEnd = tokenStart + token.length;
      const isInToken = position.character >= tokenStart && position.character <= tokenEnd;
      if (!isInToken) {
        return null;
      }

      return findSymbolLocationInFile(fileUri, token);
    });
  }
});

const createCompletionProvider = () => ({
  provideCompletionItems(document, position) {
    const lineText = document.lineAt(position.line).text;
    const beforeCursor = lineText.slice(0, position.character);

    const filenameMatch = beforeCursor.match(filenameCompletionPattern);
    if (filenameMatch) {
      const prefix = filenameMatch[1];
      return vscode.workspace.findFiles("**/*", ignoredFilesPattern, 2000).then(fileUris => {
        const filtered = fileUris
          .map(uri => vscode.workspace.asRelativePath(uri, false))
          .filter(relativePath =>
            relativePath.toLowerCase().includes(prefix.toLowerCase()) ||
            path.basename(relativePath).toLowerCase().includes(prefix.toLowerCase())
          )
          .slice(0, 200);

        const replacementStart = position.character - prefix.length;
        const replacementRange = new vscode.Range(
          position.line,
          replacementStart,
          position.line,
          position.character
        );
        return filtered.map(relativePath => {
          const item = new vscode.CompletionItem(relativePath, vscode.CompletionItemKind.File);
          item.detail = "ChangeLog file entry";
          item.range = replacementRange;
          return item;
        });
      });
    }

    const tokenMatch = beforeCursor.match(tokenCompletionPattern);
    if (!tokenMatch) {
      return [];
    }

    const fileToken = tokenMatch[1];
    const tokenPrefix = tokenMatch[2];
    return findFileUriFromToken(document, fileToken).then(fileUri => {
      if (!fileUri) {
        return [];
      }

      return collectTokenCandidates(fileUri).then(tokens => {
        const replacementStart = position.character - tokenPrefix.length;
        const replacementRange = new vscode.Range(
          position.line,
          replacementStart,
          position.line,
          position.character
        );
        return tokens
          .filter(name => name.toLowerCase().startsWith(tokenPrefix.toLowerCase()))
          .slice(0, 200)
          .map(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
            item.detail = vscode.workspace.asRelativePath(fileUri, false);
            item.range = replacementRange;
            return item;
          });
      });
    });
  }
});

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

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    { language: "changelog" },
    createCompletionProvider(),
    "/",
    "("
  );
  context.subscriptions.push(completionProvider);

  const definitionProvider = vscode.languages.registerDefinitionProvider(
    { language: "changelog" },
    createDefinitionProvider()
  );
  context.subscriptions.push(definitionProvider);
}
exports.activate = activate;

// this method is called when extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
