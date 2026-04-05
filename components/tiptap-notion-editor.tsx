'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

interface TiptapNotionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

const TEXT_COLORS = [
  { label: 'Mặc định', value: '' },
  { label: 'Đỏ', value: '#ef4444' },
  { label: 'Cam', value: '#f97316' },
  { label: 'Vàng', value: '#eab308' },
  { label: 'Xanh lá', value: '#22c55e' },
  { label: 'Xanh dương', value: '#3b82f6' },
  { label: 'Tím', value: '#a855f7' },
  { label: 'Hồng', value: '#ec4899' },
  { label: 'Xám', value: '#6b7280' },
  { label: 'Đen', value: '#111827' },
  { label: 'Xanh ngọc', value: '#0E474E' },
];

const BG_COLORS = [
  { label: 'Không', value: '' },
  { label: 'Đỏ nhạt', value: '#fee2e2' },
  { label: 'Cam nhạt', value: '#ffedd5' },
  { label: 'Vàng nhạt', value: '#fef9c3' },
  { label: 'Xanh lá nhạt', value: '#dcfce7' },
  { label: 'Xanh dương nhạt', value: '#dbeafe' },
  { label: 'Tím nhạt', value: '#f3e8ff' },
  { label: 'Hồng nhạt', value: '#fce7f3' },
  { label: 'Xám nhạt', value: '#f3f4f6' },
  { label: 'Ngọc nhạt', value: '#d3f2e7' },
  { label: 'Xanh đậm', value: '#bbf7d0' },
];

function ColorPalette({
  colors,
  onSelect,
  active,
}: {
  colors: typeof TEXT_COLORS;
  onSelect: (v: string) => void;
  active: string;
}) {
  return (
    <div className="color-palette">
      {colors.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onSelect(c.value)}
          className={`color-swatch${active === c.value ? ' selected' : ''}`}
          style={
            c.value
              ? { background: c.value }
              : {
                  background:
                    'linear-gradient(135deg, #fff 40%, #f1f5f9 40%, #f1f5f9 60%, #fff 60%)',
                  border: '1px solid #cbd5e1',
                }
          }
        />
      ))}
    </div>
  );
}

export function TiptapNotionEditor({
  value,
  onChange,
  placeholder = 'Ghi chú tự do...',
  readOnly = false,
  className,
}: TiptapNotionEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [showTextColor, setShowTextColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);
  const textColorRef = useRef<HTMLDivElement>(null);
  const bgColorRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (textColorRef.current && !textColorRef.current.contains(e.target as Node))
        setShowTextColor(false);
      if (bgColorRef.current && !bgColorRef.current.contains(e.target as Node))
        setShowBgColor(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        blockquote: {},
        code: {},
        codeBlock: {},
        horizontalRule: {},
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Typography,
      TaskList.configure({ HTMLAttributes: { class: 'not-prose pl-0' } }),
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'notion-editor focus:outline-none',
        spellcheck: 'false',
      },
    },
  });

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (!editor) return;
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const currentHtml = editor.getHTML();
    if (currentHtml !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  // Get active text/bg color
  const activeTextColor = editor?.getAttributes('textStyle')?.color ?? '';
  const activeHighlightColor = editor?.getAttributes('highlight')?.color ?? '';

  return (
    <div className={`notion-editor-wrapper ${className ?? ''}`} data-readonly={readOnly}>
      {!readOnly && editor && (
        <div className="notion-toolbar">
          {/* Text formatting */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'active' : ''}
            title="Bold (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'active' : ''}
            title="Italic (Ctrl+I)"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'active' : ''}
            title="Strikethrough"
          >
            <s>S</s>
          </button>

          <span className="toolbar-divider" />

          {/* Text color */}
          <div className="color-picker-wrap" ref={textColorRef}>
            <button
              type="button"
              className={showTextColor ? 'active' : ''}
              title="Màu chữ"
              onClick={() => {
                setShowTextColor((v) => !v);
                setShowBgColor(false);
              }}
            >
              <span className="color-btn-label">
                <span
                  className="color-btn-text"
                  style={{ borderBottomColor: activeTextColor || '#203430' }}
                >
                  A
                </span>
                <span className="color-btn-caret">▾</span>
              </span>
            </button>
            {showTextColor && (
              <div className="color-dropdown">
                <p className="color-dropdown-title">Màu chữ</p>
                <ColorPalette
                  colors={TEXT_COLORS}
                  active={activeTextColor}
                  onSelect={(color) => {
                    if (color) {
                      editor.chain().focus().setColor(color).run();
                    } else {
                      editor.chain().focus().unsetColor().run();
                    }
                    setShowTextColor(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Background color */}
          <div className="color-picker-wrap" ref={bgColorRef}>
            <button
              type="button"
              className={showBgColor ? 'active' : ''}
              title="Màu nền"
              onClick={() => {
                setShowBgColor((v) => !v);
                setShowTextColor(false);
              }}
            >
              <span className="color-btn-label">
                <span
                  className="color-btn-bg-swatch"
                  style={{ background: activeHighlightColor || '#fef08a' }}
                />
                <span className="color-btn-caret">▾</span>
              </span>
            </button>
            {showBgColor && (
              <div className="color-dropdown">
                <p className="color-dropdown-title">Màu nền</p>
                <ColorPalette
                  colors={BG_COLORS}
                  active={activeHighlightColor}
                  onSelect={(color) => {
                    if (color) {
                      editor.chain().focus().setHighlight({ color }).run();
                    } else {
                      editor.chain().focus().unsetHighlight().run();
                    }
                    setShowBgColor(false);
                  }}
                />
              </div>
            )}
          </div>

          <span className="toolbar-divider" />

          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}
            title="Heading 3"
          >
            H3
          </button>

          <span className="toolbar-divider" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'active' : ''}
            title="Bullet List"
          >
            •—
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'active' : ''}
            title="Numbered List"
          >
            1.
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={editor.isActive('taskList') ? 'active' : ''}
            title="Checklist"
          >
            ☑
          </button>

          <span className="toolbar-divider" />

          {/* Blocks */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? 'active' : ''}
            title="Quote"
          >
            ❝
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={editor.isActive('code') ? 'active' : ''}
            title="Inline Code"
          >
            {'</>'}
          </button>

          <span className="toolbar-divider" />

          {/* History */}
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            ↪
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      <style>{`
        .notion-editor-wrapper {
          border-radius: 12px;
          border: 1px solid #e2ede9;
          background: #fcfefd;
          overflow: visible;
          transition: border-color 0.15s;
          position: relative;
        }
        .notion-editor-wrapper:focus-within {
          border-color: #1DB87A;
          box-shadow: 0 0 0 2px rgba(29,184,122,0.12);
        }
        .notion-editor-wrapper[data-readonly='true'] {
          background: #f8fdfb;
        }

        /* ── Toolbar ── */
        .notion-toolbar {
          display: flex;
          align-items: center;
          gap: 1px;
          padding: 6px 8px;
          border-bottom: 1px solid #e2ede9;
          background: #f8fdfb;
          flex-wrap: wrap;
          border-radius: 12px 12px 0 0;
        }
        .notion-toolbar > button,
        .notion-toolbar .color-picker-wrap > button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 26px;
          padding: 0 5px;
          border-radius: 5px;
          border: none;
          background: transparent;
          color: #4b6359;
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .notion-toolbar > button:hover:not(:disabled),
        .notion-toolbar .color-picker-wrap > button:hover:not(:disabled) {
          background: #e2ede9;
          color: #0E474E;
        }
        .notion-toolbar > button.active,
        .notion-toolbar .color-picker-wrap > button.active {
          background: #d3f2e7;
          color: #0E474E;
          font-weight: 600;
        }
        .notion-toolbar > button:disabled {
          opacity: 0.35;
          cursor: default;
        }
        .notion-toolbar .toolbar-divider {
          width: 1px;
          height: 16px;
          background: #e2ede9;
          margin: 0 3px;
          flex-shrink: 0;
        }

        /* ── Color button ── */
        .color-btn-label {
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
        .color-btn-text {
          font-size: 13px;
          font-weight: 700;
          border-bottom: 3px solid;
          line-height: 1;
          padding-bottom: 1px;
        }
        .color-btn-bg-swatch {
          display: inline-block;
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border: 1px solid rgba(0,0,0,0.12);
        }
        .color-btn-caret {
          font-size: 9px;
          opacity: 0.5;
          margin-top: 1px;
        }

        /* ── Color picker wrap & dropdown ── */
        .color-picker-wrap {
          position: relative;
          display: inline-flex;
        }
        .color-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 100;
          background: #fff;
          border: 1px solid #e2ede9;
          border-radius: 10px;
          padding: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          min-width: 170px;
        }
        .color-dropdown-title {
          font-size: 10px;
          font-weight: 600;
          color: #6b7f78;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }
        .color-palette {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 5px;
        }
        .color-swatch {
          width: 24px;
          height: 24px;
          border-radius: 5px;
          border: 1px solid rgba(0,0,0,0.08);
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s;
          padding: 0;
        }
        .color-swatch:hover {
          transform: scale(1.18);
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .color-swatch.selected {
          outline: 2px solid #1DB87A;
          outline-offset: 2px;
        }

        /* ── Editor body ── */
        .notion-editor {
          padding: 12px 14px;
          min-height: 360px;
          max-height: 600px;
          overflow-y: auto;
          font-size: 13.5px;
          line-height: 1.65;
          color: #203430;
          border-radius: 0 0 12px 12px;
        }
        .notion-editor.is-editor-empty::before {
          content: attr(data-placeholder);
          color: #b0c8bf;
          pointer-events: none;
          position: absolute;
          font-style: italic;
        }

        /* Typography */
        .notion-editor h1 {
          font-size: 1.5em;
          font-weight: 700;
          color: #0E474E;
          margin: 1em 0 0.3em;
          line-height: 1.3;
        }
        .notion-editor h2 {
          font-size: 1.2em;
          font-weight: 600;
          color: #203430;
          margin: 0.9em 0 0.25em;
        }
        .notion-editor h3 {
          font-size: 1.05em;
          font-weight: 600;
          color: #203430;
          margin: 0.8em 0 0.2em;
        }
        .notion-editor p { margin: 0.15em 0; }
        .notion-editor ul {
          padding-left: 1.6em;
          margin: 0.3em 0;
          list-style-type: disc;
        }
        .notion-editor ol {
          padding-left: 1.6em;
          margin: 0.3em 0;
          list-style-type: decimal;
        }
        .notion-editor ul ul { list-style-type: circle; }
        .notion-editor ul ul ul { list-style-type: square; }
        .notion-editor li {
          margin: 0.1em 0;
          display: list-item;
        }
        .notion-editor blockquote {
          border-left: 3px solid #1DB87A;
          padding: 2px 10px;
          margin: 0.5em 0;
          color: #4b6359;
          background: #f0fdf9;
          border-radius: 0 6px 6px 0;
        }
        .notion-editor code {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.85em;
          background: #f1f5f9;
          border-radius: 4px;
          padding: 1px 5px;
          color: #0f5569;
        }
        .notion-editor pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 10px 14px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 12px;
          margin: 0.5em 0;
        }
        .notion-editor pre code {
          background: transparent;
          color: inherit;
          padding: 0;
        }
        .notion-editor mark {
          border-radius: 2px;
          padding: 0 1px;
        }
        .notion-editor strong { font-weight: 600; }
        .notion-editor ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0.2em;
        }
        .notion-editor ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .notion-editor ul[data-type="taskList"] li > label {
          margin-top: 2px;
          flex-shrink: 0;
        }
        .notion-editor ul[data-type="taskList"] li > label input[type="checkbox"] {
          width: 14px;
          height: 14px;
          accent-color: #1DB87A;
          cursor: pointer;
        }
        .notion-editor ul[data-type="taskList"] li[data-checked="true"] > div {
          text-decoration: line-through;
          color: #94a3b8;
        }
        .notion-editor hr {
          border: none;
          border-top: 1px solid #e2ede9;
          margin: 0.7em 0;
        }
        .notion-editor > *:first-child { margin-top: 0; }
        .notion-editor > *:last-child { margin-bottom: 0; }
      `}</style>
    </div>
  );
}
