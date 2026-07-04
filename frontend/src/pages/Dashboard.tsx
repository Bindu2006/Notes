import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Navbar } from "../components/Navbar";
import { EditNote } from "../components/EditNote";
import { ShareModal } from "../components/ShareModal";
import type { Note } from "../components/ShareModal";
import { 
  Plus, BookOpen, User, Users, ChevronRight, AlertCircle, 
  FileText, Shield, Clock, LayoutGrid, Award, FolderHeart
} from "lucide-react";

type ThemeName = "nebula" | "emerald" | "amber";

const THEME_MAP = {
  nebula: {
    bg: "bg-slate-950",
    accent: "from-blue-600 to-purple-600",
    accentHover: "from-blue-500 to-purple-500",
    card: "bg-slate-900/40",
    border: "border-slate-800/80",
    glow: "shadow-blue-500/10 hover:shadow-blue-500/20",
    text: "text-blue-400",
    badge: "bg-blue-900/30 text-blue-300 border border-blue-500/20",
    activeItem: "bg-blue-600/10 border-blue-500/40 text-white shadow-[0_0_15px_rgba(59,130,246,0.12)]",
    sidebarIcon: "text-blue-400 bg-blue-500/10",
  },
  emerald: {
    bg: "bg-[#050A08]",
    accent: "from-emerald-600 to-teal-600",
    accentHover: "from-emerald-500 to-teal-500",
    card: "bg-[#09110E]/60",
    border: "border-emerald-950/60",
    glow: "shadow-emerald-500/10 hover:shadow-emerald-500/20",
    text: "text-emerald-400",
    badge: "bg-emerald-950/40 text-emerald-300 border border-emerald-500/20",
    activeItem: "bg-emerald-600/10 border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.12)]",
    sidebarIcon: "text-emerald-400 bg-emerald-500/10",
  },
  amber: {
    bg: "bg-[#0A0907]",
    accent: "from-amber-600 to-orange-600",
    accentHover: "from-amber-500 to-orange-500",
    card: "bg-[#110F0D]/60",
    border: "border-amber-950/60",
    glow: "shadow-amber-500/10 hover:shadow-amber-500/20",
    text: "text-amber-400",
    badge: "bg-amber-900/20 text-amber-300 border border-amber-500/15",
    activeItem: "bg-amber-600/10 border-amber-500/40 text-white shadow-[0_0_15px_rgba(245,158,11,0.12)]",
    sidebarIcon: "text-amber-400 bg-amber-500/10",
  }
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const socket = useSocket();

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);

  // Load theme preference from localStorage, default to 'nebula'
  const [themeName, setThemeName] = useState<ThemeName>(
    (localStorage.getItem("notes_theme") as ThemeName) || "nebula"
  );

  const themeStyles = THEME_MAP[themeName];

  const handleThemeChange = (newTheme: ThemeName) => {
    setThemeName(newTheme);
    localStorage.setItem("notes_theme", newTheme);
  };

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      } else {
        setError("Could not load your workspace notes.");
      }
    } catch (err) {
      setError("Network error: check database or connection.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [token]);

  // Handle Socket.IO connection status & events
  useEffect(() => {
    if (!socket) {
      setSocketConnected(false);
      return;
    }

    setSocketConnected(socket.connected);

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const handleRemoteUpdate = (updatedNote: Note) => {
      setNotes((prevNotes) => {
        const index = prevNotes.findIndex((n) => n.id === updatedNote.id);
        if (index !== -1) {
          const updated = [...prevNotes];
          updated[index] = updatedNote;
          return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        }
        
        const isOwner = updatedNote.owner_id === user?.id;
        const isCollab = updatedNote.collaborators.some((c) => c.user_id === user?.id);
        if (isOwner || isCollab) {
          return [updatedNote, ...prevNotes];
        }
        return prevNotes;
      });

      setActiveNote((prevActive) => {
        if (prevActive && prevActive.id === updatedNote.id) {
          return updatedNote;
        }
        return prevActive;
      });
    };

    const handleRemoteDelete = ({ note_id }: { note_id: string }) => {
      setNotes((prev) => prev.filter((n) => n.id !== note_id));
      setActiveNote((prev) => (prev && prev.id === note_id ? null : prev));
    };

    const handleRemoteUnshare = ({ user_id, note_id }: { user_id: string; note_id: string }) => {
      if (user_id === user?.id) {
        setNotes((prev) => prev.filter((n) => n.id !== note_id));
        setActiveNote((prev) => {
          if (prev && prev.id === note_id) {
            alert("Your permissions for this document have been revoked by the owner.");
            return null;
          }
          return prev;
        });
      }
    };

    socket.on("note_updated", handleRemoteUpdate);
    socket.on("note_deleted", handleRemoteDelete);
    socket.on("user_unshared", handleRemoteUnshare);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("note_updated", handleRemoteUpdate);
      socket.off("note_deleted", handleRemoteDelete);
      socket.off("user_unshared", handleRemoteUnshare);
    };
  }, [socket, user?.id]);

  const handleCreateNote = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "New Note Document",
          content: "",
        }),
      });

      if (res.ok) {
        const newNote = await res.json();
        setNotes((prev) => [newNote, ...prev]);
        setActiveNote(newNote);
      } else {
        setError("Could not initialize a new note document.");
      }
    } catch (err) {
      setError("Failed to create note due to database network error.");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/notes/${noteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        if (activeNote && activeNote.id === noteId) {
          setActiveNote(null);
        }
      } else {
        setError("Failed to delete selected note.");
      }
    } catch (err) {
      setError("Failed to delete note due to server connection error.");
    }
  };

  const handleUpdateNoteState = (updatedNote: Note) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
    );
    if (activeNote && activeNote.id === updatedNote.id) {
      setActiveNote(updatedNote);
    }
  };

  // Human relative time formatter helper
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMs = new Date().getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const ownedNotes = notes.filter((n) => n.owner_id === user?.id);
  const sharedNotes = notes.filter((n) => n.owner_id !== user?.id);

  return (
    <div className={`h-screen flex flex-col ${themeStyles.bg} text-slate-100 overflow-hidden font-sans transition duration-500`}>
      <Navbar 
        currentTheme={themeName} 
        onChangeTheme={handleThemeChange} 
        socketConnected={socketConnected}
      />

      <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0 relative">
        {/* Glow ambient panels */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-600 rounded-full filter blur-[140px] opacity-10 pointer-events-none"></div>
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-purple-600 rounded-full filter blur-[140px] opacity-10 pointer-events-none"></div>

        {/* Bespoke Sidebar Directory */}
        <div className={`w-88 flex flex-col shrink-0 glass-effect ${themeStyles.card} rounded-3xl border ${themeStyles.border} p-5 overflow-hidden transition`}>
          
          {/* Header Action */}
          <button
            onClick={handleCreateNote}
            className={`w-full mb-6 py-3.5 px-4 bg-gradient-to-r ${themeStyles.accent} hover:to-indigo-500 text-white rounded-2xl shadow-xl ${themeStyles.glow} active:scale-[0.98] transition font-bold flex items-center justify-center gap-2.5`}
          >
            <Plus className="w-5 h-5" />
            <span>Create New Document</span>
          </button>

          {/* Stats Deck Panel */}
          <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
            <div className="text-center p-2.5 rounded-xl bg-slate-900/30">
              <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">My Notes</span>
              <span className="text-lg font-black text-white">{ownedNotes.length}</span>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-slate-900/30">
              <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Shared</span>
              <span className="text-lg font-black text-white">{sharedNotes.length}</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-500/40 text-red-200 px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Directory Scroll List */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-1.5 scrollbar-thin">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-6 h-6 border-2 border-slate-800 border-t-slate-500 rounded-full animate-spin"></div>
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Loading Studio...</span>
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <BookOpen className="w-10 h-10 mx-auto opacity-20 mb-3" />
                <p className="text-xs font-semibold">Workspace is clean. Create a document to begin.</p>
              </div>
            ) : (
              <>
                {/* Owned Section */}
                {ownedNotes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2.5 mb-3 flex items-center gap-2">
                      <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
                      <span>My Documents</span>
                    </h3>
                    <div className="space-y-2">
                      {ownedNotes.map((noteItem) => (
                        <button
                          key={noteItem.id}
                          onClick={() => setActiveNote(noteItem)}
                          className={`w-full text-left p-4 rounded-2xl border transition duration-200 flex items-start justify-between relative group ${
                            activeNote?.id === noteItem.id
                              ? themeStyles.activeItem
                              : `bg-slate-900/20 border-slate-850 hover:bg-slate-900/50 hover:border-slate-800`
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                              activeNote?.id === noteItem.id ? "bg-slate-950 text-white" : themeStyles.sidebarIcon
                            }`}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-sm truncate leading-tight text-white group-hover:text-white">
                                {noteItem.title || "Untitled Document"}
                              </h4>
                              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mt-1.5 font-semibold">
                                <Clock className="w-3 h-3" />
                                <span>{formatRelativeTime(noteItem.updated_at)}</span>
                                {noteItem.collaborators.length > 0 && (
                                  <>
                                    <span className="inline-block h-1 w-1 rounded-full bg-slate-700" />
                                    <Users className="w-3 h-3 text-slate-400" />
                                    <span>{noteItem.collaborators.length}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition shrink-0 ml-2 mt-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shared Section */}
                {sharedNotes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2.5 mb-3 flex items-center gap-2">
                      <FolderHeart className="w-3.5 h-3.5 text-slate-500" />
                      <span>Shared Collaboration</span>
                    </h3>
                    <div className="space-y-2">
                      {sharedNotes.map((noteItem) => {
                        const role = noteItem.collaborators.find((c) => c.user_id === user?.id)?.role;
                        return (
                          <button
                            key={noteItem.id}
                            onClick={() => setActiveNote(noteItem)}
                            className={`w-full text-left p-4 rounded-2xl border transition duration-200 flex items-start justify-between relative group ${
                              activeNote?.id === noteItem.id
                                ? themeStyles.activeItem
                                : `bg-slate-900/20 border-slate-850 hover:bg-slate-900/50 hover:border-slate-800`
                            }`}
                          >
                            <div className="min-w-0 flex-1 flex items-start gap-3">
                              <div className={`p-2.5 rounded-xl shrink-0 ${
                                activeNote?.id === noteItem.id ? "bg-slate-950 text-white" : themeStyles.sidebarIcon
                              }`}>
                                <Users className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-sm truncate leading-tight text-white group-hover:text-white">
                                    {noteItem.title || "Untitled Document"}
                                  </h4>
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                    role === "edit" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400"
                                  }`}>
                                    {role}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mt-1.5 font-semibold">
                                  <span>By {noteItem.owner_username}</span>
                                  <span className="inline-block h-1 w-1 rounded-full bg-slate-700" />
                                  <Clock className="w-3 h-3" />
                                  <span>{formatRelativeTime(noteItem.updated_at)}</span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition shrink-0 ml-2 mt-2" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Workplace Main Panel */}
        <div className="flex-1 flex overflow-hidden">
          {activeNote ? (
            <EditNote
              note={activeNote}
              onUpdateNote={handleUpdateNoteState}
              onDeleteNote={handleDeleteNote}
              onShareClick={() => setIsShareOpen(true)}
              themeStyles={themeStyles}
            />
          ) : (
            <div className={`flex-1 flex flex-col items-center justify-center glass-effect bg-slate-900/10 rounded-3xl border ${themeStyles.border} p-8 text-center`}>
              <div className="bg-slate-900/70 p-6 rounded-[2.5rem] border border-slate-800/80 shadow-2xl mb-5 relative">
                <div className={`absolute -inset-1 rounded-[2.5rem] bg-gradient-to-tr ${themeStyles.accent} opacity-20 blur-md`}></div>
                <FileText className={`w-14 h-14 relative z-10 ${themeStyles.text}`} />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Studio Workspace</h2>
              <p className="text-slate-500 text-sm max-w-sm mt-2 font-medium leading-relaxed">
                Select an active sheet from the sidebar directory or tap "Create New Document" to initialize a real-time collaborative workspace.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Share collaboration config sheet */}
      {isShareOpen && activeNote && (
        <ShareModal
          note={activeNote}
          onClose={() => setIsShareOpen(false)}
          onUpdateNote={handleUpdateNoteState}
        />
      )}
    </div>
  );
};
