# AI Text Autocomplete Chrome Extension

An AI-powered Chrome Extension that provides inline text autocomplete for any editable field on any website. Inspired by GitHub Copilot, the extension displays ghost-text suggestions while the user types and allows accepting suggestions instantly using the **Tab** key.

The extension works with `<textarea>`, text `<input>` elements, and `contenteditable` fields while preserving the website's normal behavior.

---

## Features

- AI-powered inline autocomplete
- Works across websites
- Ghost text suggestions displayed at the caret position
- Accept suggestions using the **Tab** key
- Automatically dismiss suggestions on:
  - Escape
  - Focus changes
  - Cursor movement
  - Text selection
- Request debouncing to reduce unnecessary API calls
- In-memory caching for repeated prompts
- Configurable API key and model through the extension popup

---

## Technologies Used

- JavaScript (ES6+)
- HTML5
- CSS3
- Chrome Extensions Manifest V3
- Chrome Storage API
- Chrome Runtime Messaging
- OpenRouter API

---

## Project Structure

```
.
├── manifest.json
├── background.js
├── content.js
├── content.css
├── popup.html
├── popup.css
├── popup.js
└── README.md
```

### background.js

Responsible for:

- Receiving requests from the content script
- Calling the OpenRouter API
- Returning AI completions
- Caching previous responses

### content.js

Responsible for:

- Detecting editable elements
- Listening for user input
- Debouncing requests
- Displaying ghost text
- Accepting suggestions using the Tab key
- Handling edge cases such as scrolling, selection changes, and focus changes

### popup

Provides a simple settings page where users can:

- Enable/disable the extension
- Save their OpenRouter API key
- Select the AI model

---

## Installation

1. Clone this repository.

2. Open Chrome and navigate to:

```
chrome://extensions
```

3. Enable **Developer Mode**.

4. Click **Load unpacked**.

5. Select the project folder.

6. Click the extension icon.

7. Enter your OpenRouter API key.

8. Choose the desired AI model.

9. Start typing in any supported text field.

---

## Challenges

During development, several challenges had to be addressed:

- Creating inline ghost text for native input elements.
- Keeping suggestions aligned with the caret position.
- Preventing interference with the website's own JavaScript.
- Handling asynchronous API requests without showing outdated suggestions.
- Maintaining browser undo/redo functionality when accepting suggestions.
- Reducing latency through debouncing and response caching.

---

## Future Improvements

- Streaming AI responses.
- Better support for rich text editors.
- Mid-text autocomplete instead of only end-of-line suggestions.
- Multiple suggestion options.
- Per-site enable/disable settings.
- Smarter caching strategies.

---

## Skills Learned

- Chrome Extension Development (Manifest V3)
- JavaScript
- DOM Manipulation
- Chrome Storage API
- Chrome Runtime Messaging
- OpenRouter API Integration
- Prompt Engineering
- Debouncing
- API Integration
- Event Handling
- Git & GitHub
- Debugging Chrome Extensions

---

## License

This project was developed for educational purposes.