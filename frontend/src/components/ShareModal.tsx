import React, { useState } from "react";
import { X, UserPlus, Trash2, Eye, Edit2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export interface Collaborator {
  user_id: string;
  username: string;
  role: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  owner_username: string;
  collaborators: Collaborator[];
  created_at: string;
  updated_at: string;
}

interface ShareModalProps {
  note: Note;
  onClose: () => void;
  onUpdateNote: (updatedNote: Note) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const ShareModal: React.FC<ShareModalProps> = ({ note, onClose, onUpdateNote }) => {
  const { token } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState("read");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/notes/${note.id}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          collaborator_identifier: identifier,
          role,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to share note");
      }

      const updated = await res.json();
      onUpdateNote(updated);
      setIdentifier("");
    } catch (err: any) {
      setError(err.message || "Failed to invite collaborator");
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async (userId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/notes/${note.id}/unshare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to remove collaborator");
      }

      const updated = await res.json();
      onUpdateNote(updated);
    } catch (err: any) {
      setError(err.message || "Failed to remove collaborator");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-effect bg-slate-900 rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">Share Note</h2>
            <p className="text-xs text-slate-400 mt-0.5">"{note.title || "Untitled Note"}"</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800/80 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-2.5 rounded-lg flex items-start gap-2 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Add collaborator Form */}
          <form onSubmit={handleShare} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Collaborator username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:border-blue-500 transition cursor-pointer"
              >
                <option value="read">Viewer</option>
                <option value="edit">Editor</option>
              </select>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition duration-150 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Collaborator</span>
            </button>
          </form>

          {/* Collaborator List */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Existing Collaborators
            </h3>
            {note.collaborators.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No collaborators added yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {note.collaborators.map((collab) => (
                  <div
                    key={collab.user_id}
                    className="flex items-center justify-between bg-slate-800/35 border border-slate-800/60 px-4 py-2.5 rounded-xl"
                  >
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-semibold">{collab.username}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        {collab.role === "edit" ? (
                          <>
                            <Edit2 className="w-3 h-3 text-purple-400" />
                            <span>Can edit</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 text-blue-400" />
                            <span>Can view</span>
                          </>
                        )}
                      </span>
                    </div>

                    <button
                      onClick={() => handleUnshare(collab.user_id)}
                      className="text-slate-500 hover:text-red-400 hover:bg-slate-800/80 p-2 rounded-lg transition"
                      title="Remove Access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
