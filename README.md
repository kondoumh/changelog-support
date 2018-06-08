# changelog-support

Visual Studio Code extension for support Writing ChangeLog.

Note:
Rather than writing software changes, I assume that we will use the ChangeLog form for taking notes.

## Features

- ChangeLog syntax highlighting
- Insert headline (date & mail address)
- Insert item set (for weekday / weekend)

## Extension Settings

This extension contributes the following settings:

- `changelog.mailaddress`: your mail address for headline
- `changelog.weekdayitems`: labels you use in weekday.
- `changelog.weekenditems`: labels you use in weekend.

example:
```json
"changelog.mailaddress": "your@mail.address",
"changelog.weekdayitems": [
    "task",
    "meeting",
    "development"
],
"changelog.weekenditems": [
    "driving",
    "fishing"
]
```

## Release Notes

### 0.0.1

Initial release

### 0.0.2

Integrate syntax highliting
