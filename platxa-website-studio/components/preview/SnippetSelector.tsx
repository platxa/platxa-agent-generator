"use client";

import { useEffect, useCallback, RefObject } from "react";
import { useEditorStore } from "@/lib/stores";

/**
 * Message payload sent from the preview iframe when a snippet is clicked.
 */
export interface SnippetSelectMessage {
  type: "platxa:snippet-select";
  snippetId: string;
  /** Outer HTML tag name + classes for display */
  element: string;
}

/**
 * Script injected into the preview iframe to detect snippet clicks.
 * Walks up from click target to find the nearest Odoo snippet section
 * (elements with class matching /^s_/ or data-snippet attribute),
 * then posts a message to the parent window.
 */
export const SNIPPET_SELECT_SCRIPT = `
<script>
(function() {
  var SNIPPET_CLASS_RE = /\\bs_[a-z][a-z0-9_]*/;

  function findSnippetAncestor(el) {
    while (el && el !== document.body) {
      // data-snippet is the canonical Odoo attribute
      if (el.dataset && el.dataset.snippet) {
        return { id: el.dataset.snippet, element: describeElement(el) };
      }
      // Fallback: class starting with s_
      if (el.className && typeof el.className === 'string') {
        var match = el.className.match(SNIPPET_CLASS_RE);
        if (match) {
          return { id: match[0], element: describeElement(el) };
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function describeElement(el) {
    var tag = el.tagName.toLowerCase();
    var cls = (el.className || '').toString().trim();
    return cls ? tag + '.' + cls.split(/\\s+/).join('.') : tag;
  }

  // Highlight style
  var style = document.createElement('style');
  style.textContent =
    '[data-platxa-selected] {' +
    '  outline: 2px solid #7c3aed !important;' +
    '  outline-offset: 2px;' +
    '  position: relative;' +
    '}' +
    '[data-platxa-selected]::after {' +
    '  content: attr(data-platxa-selected);' +
    '  position: absolute;' +
    '  top: -1.5rem;' +
    '  left: 0;' +
    '  background: #7c3aed;' +
    '  color: #fff;' +
    '  font-size: 11px;' +
    '  padding: 2px 8px;' +
    '  border-radius: 4px;' +
    '  font-family: ui-monospace, monospace;' +
    '  z-index: 9999;' +
    '  pointer-events: none;' +
    '}';
  document.head.appendChild(style);

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    // Clear previous selection
    var prev = document.querySelector('[data-platxa-selected]');
    if (prev) prev.removeAttribute('data-platxa-selected');

    var result = findSnippetAncestor(e.target);
    if (result) {
      // Find and highlight the snippet element
      var selector = result.id.indexOf('s_') === 0
        ? '.' + result.id + ', [data-snippet="' + result.id + '"]'
        : '[data-snippet="' + result.id + '"]';
      var el = document.querySelector(selector);
      if (el) el.setAttribute('data-platxa-selected', result.id);

      window.parent.postMessage({
        type: 'platxa:snippet-select',
        snippetId: result.id,
        element: result.element
      }, '*');
    } else {
      // Clicked outside any snippet — deselect
      window.parent.postMessage({
        type: 'platxa:snippet-select',
        snippetId: '',
        element: ''
      }, '*');
    }
  }, true);
})();
</script>`;

interface SnippetSelectorProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  enabled: boolean;
}

/**
 * Invisible component that listens for snippet selection messages
 * from the preview iframe and updates the editor store.
 */
export function SnippetSelector({ enabled }: SnippetSelectorProps) {
  const selectSnippet = useEditorStore((s) => s.selectSnippet);
  const clearSnippetSelection = useEditorStore((s) => s.clearSnippetSelection);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!enabled) return;
      const data = event.data;
      if (data && data.type === "platxa:snippet-select") {
        if (data.snippetId) {
          selectSnippet(data.snippetId, data.element || null);
        } else {
          clearSnippetSelection();
        }
      }
    },
    [enabled, selectSnippet, clearSnippetSelection],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [enabled, handleMessage]);

  // Clear selection when disabled
  useEffect(() => {
    if (!enabled) {
      clearSnippetSelection();
    }
  }, [enabled, clearSnippetSelection]);

  return null;
}
