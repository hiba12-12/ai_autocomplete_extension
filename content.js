
(() => {
  const DEBOUNCE_MS = 300;
  const MIN_CHARS = 3;
  const MAX_CONTEXT_CHARS = 1500;

  let enabled = true;
  let currentTarget = null;
  let currentSuggestion = '';
  let requestId = 0;
  let debounceTimer = null;
  let overlayEl = null;
  let mirrorDiv = null;

  chrome.storage.sync.get(['enabled'], (r) => {
    enabled = r.enabled !== false;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      enabled = changes.enabled.newValue;
      if (!enabled) hideSuggestion();
    }
  });

  const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel']);

  function isEditable(el) {
    if (!el || !(el instanceof Element)) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') return TEXT_INPUT_TYPES.has((el.type || 'text').toLowerCase());
    if (el.isContentEditable) return true;
    return false;
  }

  function ensureOverlay() {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = '__ai_autocomplete_overlay__';
      overlayEl.setAttribute('aria-hidden', 'true');
      document.documentElement.appendChild(overlayEl);
    }
    return overlayEl;
  }

  function hideSuggestion() {
    currentSuggestion = '';
    currentTarget = null;
    if (overlayEl) overlayEl.style.display = 'none';
  }

  const MIRROR_STYLE_PROPS = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'wordSpacing', 'textIndent', 'wordBreak'
  ];

  function getMirrorDiv(target) {
    if (!mirrorDiv) {
      mirrorDiv = document.createElement('div');
      mirrorDiv.id = '__ai_autocomplete_mirror__';
      document.documentElement.appendChild(mirrorDiv);
    }
    const cs = getComputedStyle(target);
    MIRROR_STYLE_PROPS.forEach((p) => { mirrorDiv.style[p] = cs[p]; });
    mirrorDiv.style.whiteSpace = target.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre';
    mirrorDiv.style.overflowWrap = 'break-word';
    mirrorDiv.style.width = target.tagName === 'TEXTAREA' ? cs.width : 'auto';
    return mirrorDiv;
  }

  function getCaretCoordsForInput(target, caretIndex) {
    const mirror = getMirrorDiv(target);
    const value = target.value || '';
    mirror.textContent = '';
    mirror.appendChild(document.createTextNode(value.substring(0, caretIndex)));
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    mirror.appendChild(marker);
    mirror.appendChild(document.createTextNode(value.substring(caretIndex) || ' '));

    const targetRect = target.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();

    return {
      x: targetRect.left + (markerRect.left - mirrorRect.left) - target.scrollLeft,
      y: targetRect.top + (markerRect.top - mirrorRect.top) - target.scrollTop,
      lineHeight: parseFloat(getComputedStyle(target).lineHeight) || markerRect.height
    };
  }

  function getCaretCoordsForContentEditable() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    let rect = range.getClientRects()[0];
    if (!rect) {
      
      const marker = document.createElement('span');
      marker.textContent = '\u200b';
      range.insertNode(marker);
      rect = marker.getBoundingClientRect();
      marker.remove();
    }
    return rect ? { x: rect.left, y: rect.top, lineHeight: rect.height } : null;
  }

  function isCaretAtEnd(target) {
    if (target.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return false;
      const range = sel.getRangeAt(0);
      const tail = range.cloneRange();
      tail.selectNodeContents(target);
      tail.setStart(range.endContainer, range.endOffset);
      return tail.toString().length === 0;
    }
    return target.selectionEnd === target.value.length;
  }

  function hasSelection(target) {
    if (target.isContentEditable) {
      const sel = window.getSelection();
      return sel && !sel.isCollapsed;
    }
    return target.selectionStart !== target.selectionEnd;
  }

  function getTextBeforeCaret(target) {
    if (target.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return target.innerText || '';
      const range = sel.getRangeAt(0);
      const pre = range.cloneRange();
      pre.selectNodeContents(target);
      pre.setEnd(range.endContainer, range.endOffset);
      return pre.toString();
    }
    return target.value.substring(0, target.selectionEnd);
  }

  function renderSuggestion(target, suggestion) {
    if (!suggestion) { hideSuggestion(); return; }

    const coords = target.isContentEditable
      ? getCaretCoordsForContentEditable()
      : getCaretCoordsForInput(target, target.selectionEnd);
    if (!coords) { hideSuggestion(); return; }

    const overlay = ensureOverlay();
    const cs = getComputedStyle(target);

    overlay.style.display = 'block';
    overlay.style.left = `${coords.x}px`;
    overlay.style.top = `${coords.y}px`;
    overlay.style.fontFamily = cs.fontFamily;
    overlay.style.fontSize = cs.fontSize;
    overlay.style.fontStyle = cs.fontStyle;
    overlay.style.fontWeight = cs.fontWeight;
    overlay.style.lineHeight = cs.lineHeight;
    overlay.style.letterSpacing = cs.letterSpacing;
    overlay.textContent = suggestion;

    const rect = target.getBoundingClientRect();
    const top = Math.max(0, rect.top - coords.y);
    const bottom = Math.max(0, coords.y - rect.bottom + coords.lineHeight);
    const right = Math.max(0, coords.x - rect.right);
    overlay.style.clipPath = `inset(${top}px ${right < 0 ? 0 : 0}px ${bottom}px 0px)`;
    overlay.style.maxWidth = `${Math.max(0, rect.right - coords.x)}px`;
    overlay.style.overflow = 'hidden';
    overlay.style.textOverflow = 'clip';
  }

  function repositionIfVisible() {
    if (currentTarget && currentSuggestion && document.contains(currentTarget)) {
      renderSuggestion(currentTarget, currentSuggestion);
    } else if (currentTarget && !document.contains(currentTarget)) {
      hideSuggestion();
    }
  }

  function requestCompletion(target) {
    if (!enabled) return;
    if (hasSelection(target) || !isCaretAtEnd(target)) { hideSuggestion(); return; }

    const textBefore = getTextBeforeCaret(target).slice(-MAX_CONTEXT_CHARS);
    if (textBefore.trim().length < MIN_CHARS) { hideSuggestion(); return; }

    const myId = ++requestId;
    chrome.runtime.sendMessage({ type: 'GET_COMPLETION', text: textBefore }, (res) => {
      if (myId !== requestId) return; 
      if (chrome.runtime.lastError || !res || res.error || !res.completion) {
        hideSuggestion();
        return;
      }
      if (document.activeElement !== target) return;
      if (getTextBeforeCaret(target) !== textBefore) return; // text moved on while we waited

      currentTarget = target;
      currentSuggestion = res.completion;
      renderSuggestion(target, currentSuggestion);
    });
  }

  function scheduleCompletion(target) {
    hideSuggestion();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => requestCompletion(target), DEBOUNCE_MS);
  }

  
  function acceptSuggestion(target) {
    if (!currentSuggestion) return false;
    const ok = document.execCommand('insertText', false, currentSuggestion);
    if (!ok) {
      // Fallback for the rare case execCommand is unsupported.
      if (!target.isContentEditable) {
        const start = target.selectionStart;
        target.setRangeText(currentSuggestion, start, start, 'end');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    hideSuggestion();
    return true;
  }

  document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    const target = e.target;
    if (!isEditable(target)) return;

    if (e.key === 'Tab' && currentSuggestion && document.activeElement === target) {
      e.preventDefault();
      acceptSuggestion(target);
      return;
    }
    if (e.key === 'Escape' && currentSuggestion) {
      hideSuggestion();
      return;
    }
    if (currentSuggestion && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      hideSuggestion();
    }
  }, true);

  document.addEventListener('input', (e) => {
    if (!enabled) return;
    if (!isEditable(e.target)) return;
    scheduleCompletion(e.target);
  }, true);

  document.addEventListener('scroll', () => repositionIfVisible(), true);
  window.addEventListener('resize', () => repositionIfVisible());

  document.addEventListener('selectionchange', () => {
    if (currentTarget && currentSuggestion && document.activeElement === currentTarget) {
      if (hasSelection(currentTarget) || !isCaretAtEnd(currentTarget)) hideSuggestion();
    }
  });

  document.addEventListener('focusout', (e) => {
    if (e.target === currentTarget) hideSuggestion();
  }, true);

  document.addEventListener('mousedown', (e) => {
    if (isEditable(e.target)) hideSuggestion();
  }, true);
})();