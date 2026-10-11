import React, { useState, useEffect, useRef } from "react";
import type { Note } from "./ShareModal";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import {
  Save, Eye, Edit2, Share2, Trash2, Shield, AlertTriangle,
  Bold, Italic, Heading1, Heading2, List, Code,
} from "lucide-react";

interface EditNoteProps {
  note: Note;
  onUpdateNote: (updatedNote: Note) => void;
  onDeleteNote: (noteId: string) => void;
  onShareClick: () => void;
  themeStyles: {
    text: string;
    accent: string;
    accentHover: string;
    border: string;
    badge: string;
  };
}

export const EditNote: React.FC<EditNoteProps> = ({
  note,
  onUpdateNote,
  onDeleteNote,
  onShareClick,
  themeStyles
}) => {
  const { user } = useAuth();
  const socket = useSocket();

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [focusedField, setFocusedField] = useState<"title" | "content" | null>(null);

  const isOwner = note.owner_id === user?.id;
  const userRole = note.collaborators.find((c) => c.user_id === user?.id)?.role;
  const canEdit = isOwner || userRole === "edit";

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync internal states when selected note changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setLastSaved(new Date(note.updated_at));
    setViewMode("edit");
  }, [note.id]);

  // Socket sync
  useEffect(() => {
    if (!socket) return;

    socket.emit("join_note", { note_id: note.id });

    const handleRemoteUpdate = (updatedNote: Note) => {
      if (updatedNote.id !== note.id) return;
      onUpdateNote(updatedNote);

      if (focusedField !== "title" && updatedNote.title !== title) {
        setTitle(updatedNote.title);
      }
      if (focusedField !== "content" && updatedNote.content !== content) {
        setContent(updatedNote.content);
      }
      setLastSaved(new Date(updatedNote.updated_at));
    };

    socket.on("note_updated", handleRemoteUpdate);

    return () => {
      socket.emit("leave_note", { note_id: note.id });
      socket.off("note_updated", handleRemoteUpdate);
    };
  }, [socket, note.id, focusedField, title, content]);

  // Debounced Autosave via Socket.IO
  useEffect(() => {
    if (title === note.title && content === note.content) {
      return;
    }

    if (!canEdit) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(true);

    saveTimeoutRef.current = setTimeout(() => {
      if (!socket) {
        setIsSaving(false);
        return;
      }

      socket.emit(
        "edit_note",
        { note_id: note.id, title, content, base_updated_at: note.updated_at },
        (response: any) => {
          if (response && response.status === "ok") {
            onUpdateNote(response.note);
            setLastSaved(new Date(response.note.updated_at));
          } else {
            console.error("Autosave error:", response?.message);
            window.alert("This note changed elsewhere while you were editing. Refresh the note to avoid overwriting someone else’s changes.");
          }
          setIsSaving(false);
        }
      );
    }, 750);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, note.id, socket]);

  const handleSaveClick = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!socket) return;

    setIsSaving(true);
    socket.emit(
      "edit_note",
      { note_id: note.id, title, content, base_updated_at: note.updated_at },
      (response: any) => {
        if (response && response.status === "ok") {
          onUpdateNote(response.note);
          setLastSaved(new Date(response.note.updated_at));
        } else {
          console.error("Save error:", response?.message);
          window.alert("This note changed elsewhere while you were editing. Refresh the note to avoid overwriting someone else’s changes.");
        }
        setIsSaving(false);
      }
    );
  };

  // Helper to inject markdown wrappers at cursor selection point
  const injectMarkdown = (syntaxType: "bold" | "italic" | "h1" | "h2" | "bullet" | "code") => {
    if (!textareaRef.current || !canEdit) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalText = content;
    const selectedText = originalText.substring(start, end);

    let prefix = "";
    let suffix = "";

    switch (syntaxType) {
      case "bold":
        prefix = "**";
        suffix = "**";
        break;
      case "italic":
        prefix = "*";
        suffix = "*";
        break;
      case "h1":
        prefix = "\n# ";
        suffix = "";
        break;
      case "h2":
        prefix = "\n## ";
        suffix = "";
        break;
      case "bullet":
        prefix = "\n- ";
        suffix = "";
        break;
      case "code":
        prefix = "`";
        suffix = "`";
        break;
    }

    const replacement = prefix + (selectedText || "text") + suffix;
    const newContent = originalText.substring(0, start) + replacement + originalText.substring(end);
    
    setContent(newContent);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      const offset = prefix.length;
      textarea.setSelectionRange(start + offset, start + offset + (selectedText || "text").length);
    }, 50);
  };

  const parseMarkdown = (text: string) => {
    if (!text) return '<p class="text-slate-500 italic">Empty note. Use the toolbar or start writing markdown...</p>';

    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-white mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-white mt-5 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
    
    // Italics
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-slate-200">$1</em>');
    
    // Code
    html = html.replace(/`(.*?)`/g, '<code class="bg-slate-800 text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

    // Bullets
    html = html.replace(/^\- (.*$)/gim, '<li class="list-disc ml-5 text-slate-300 my-1">$1</li>');
    
    // Line breaks
    html = html.replace(/\n/g, "<br />");
    
    return html;
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-slate-900/30 rounded-3xl border ${themeStyles.border} overflow-hidden shadow-2xl transition duration-300`}>
      
      {/* Workspace Header Dashboard */}
      <div className="px-6 py-4 bg-slate-900/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
        
        {/* Info indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`flex h-2 w-2 relative ${isSaving ? "visible" : "invisible"}`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${themeStyles.text.replace('text-', 'bg-')}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${themeStyles.text.replace('text-', 'bg-')}`}></span>
            </span>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {isSaving ? "Saving changes..." : `Saved at ${lastSaved ? lastSaved.toLocaleTimeString() : "..."}`}
            </span>
          </div>

          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${themeStyles.badge}`}>
            <Shield className="w-3 h-3" />
            <span>{isOwner ? "Owner" : `Collaborator (${userRole})`}</span>
          </span>
        </div>

        {/* Action button bar */}
        <div className="flex items-center gap-2">
          {/* Toggle editor / preview */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mr-1">
            <button
              onClick={() => setViewMode("edit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
                viewMode === "edit" ? "bg-slate-800 text-white shadow" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Write</span>
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
                viewMode === "preview" ? "bg-slate-800 text-white shadow" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {isOwner && (
            <button
              onClick={onShareClick}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 rounded-xl text-xs font-bold transition active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r ${themeStyles.accent} hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => {
                if (window.confirm("Delete this workspace note? This action cannot be undone.")) {
                  onDeleteNote(note.id);
                }
              }}
              className="flex items-center justify-center p-2.5 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 rounded-xl text-red-400 transition active:scale-95"
              title="Delete Note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Markdown Text Toolbar */}
      {viewMode === "edit" && (
        <div className="px-6 py-2 bg-slate-900/30 border-b border-slate-800/60 flex items-center gap-1 shrink-0">
          <button
            onClick={() => injectMarkdown("bold")}
            disabled={!canEdit}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-30"
            title="Bold (**text**)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => injectMarkdown("italic")}
            disabled={!canEdit}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-30"
            title="Italic (*text*)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-1"></div>
          <button
            onClick={() => injectMarkdown("h1")}
            disabled={!canEdit}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-30"
            title="Heading 1 (# Heading)"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => injectMarkdown("h2")}
            disabled={!canEdit}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-30"
            title="Heading 2 (## Heading)"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-1"></div>
          <button
            onClick={() => injectMarkdown("bullet")}
            disabled={!canEdit}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-30"
            title="Bullet List (- Item)"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => injectMarkdown("code")}
            disabled={!canEdit}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-30"
            title="Inline Code (`code`)"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
        {!canEdit && viewMode === "edit" && (
          <div className="mb-4 bg-amber-950/20 border border-amber-900/40 text-amber-300 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Read-only: You do not have permission to edit this note.</span>
          </div>
        )}

        {viewMode === "edit" ? (
          <div className="flex-1 flex flex-col gap-3 h-full">
            <input
              type="text"
              placeholder="Workspace Document Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setFocusedField("title")}
              onBlur={() => setFocusedField(null)}
              disabled={!canEdit}
              className="w-full bg-transparent text-2xl font-extrabold text-white placeholder-slate-700 outline-none pb-2 transition"
            />
            
            <textarea
              ref={textareaRef}
              placeholder="Unleash your creative ideas here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setFocusedField("content")}
              onBlur={() => setFocusedField(null)}
              disabled={!canEdit}
              className="w-full flex-1 bg-transparent text-slate-300 placeholder-slate-700 outline-none resize-none font-mono text-sm leading-relaxed overflow-y-auto"
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 select-text">
            <h1 className="text-3xl font-extrabold text-white mb-6 border-b border-slate-800/80 pb-3">
              {title || <span className="text-slate-700 italic">Untitled Note</span>}
            </h1>
            <div
              className="text-slate-300 text-sm leading-relaxed prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
