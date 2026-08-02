"use client";
/**
 * Chat history list — one implementation shared by the desktop sidebar and the
 * mobile drawer so both platforms behave identically: new chat, reopen, rename,
 * pin (pinned float to the top) and delete.
 */
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, MoreVertical, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import {
  listConversations,
  deleteConversation,
  renameConversation,
  setConversationPinned,
  type ConversationMeta,
} from "../lib/user-data";

/** Fires so every mounted history list refreshes and re-highlights. */
export function announceConversations(activeId: string | null) {
  window.dispatchEvent(new CustomEvent("calolean:conversations", { detail: { activeId } }));
}

export default function ChatHistory({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const router = useRouter();
  const [chats, setChats] = React.useState<ConversationMeta[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(() => {
    if (!user?.uid) {
      setChats([]);
      return;
    }
    listConversations(user.uid).then(setChats).catch(() => {});
  }, [user]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // Initial active id from the URL (?c=…). Read client-side so this stays free
  // of useSearchParams, which would force a Suspense boundary in every parent.
  React.useEffect(() => {
    try {
      setActiveId(new URLSearchParams(window.location.search).get("c"));
    } catch {
      /* noop */
    }
  }, []);

  // Home fires this after each turn (new chat, updated preview, active change).
  React.useEffect(() => {
    const onConversations = (event: Event) => {
      const detail = (event as CustomEvent<{ activeId: string | null }>).detail;
      if (detail && "activeId" in detail) setActiveId(detail.activeId ?? null);
      refresh();
    };
    window.addEventListener("calolean:conversations", onConversations);
    return () => window.removeEventListener("calolean:conversations", onConversations);
  }, [refresh]);

  // Close the row menu on any outside interaction.
  React.useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [menuFor]);

  React.useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const handleDelete = async (id: string) => {
    if (!user?.uid) return;
    setMenuFor(null);
    setChats((prev) => prev.filter((c) => c.id !== id)); // optimistic
    try {
      await deleteConversation(user.uid, id);
    } catch {
      /* noop */
    }
    if (id === activeId) {
      setActiveId(null);
      router.push("/");
    }
  };

  const handleTogglePin = async (chat: ConversationMeta) => {
    if (!user?.uid) return;
    setMenuFor(null);
    const pinned = !chat.pinned;
    setChats((prev) =>
      prev
        .map((c) => (c.id === chat.id ? { ...c, pinned } : c))
        .sort((a, b) =>
          Boolean(a.pinned) === Boolean(b.pinned)
            ? (b.updated_at || "").localeCompare(a.updated_at || "")
            : a.pinned
            ? -1
            : 1
        )
    );
    try {
      await setConversationPinned(user.uid, chat.id, pinned);
    } catch {
      refresh();
    }
  };

  const startRename = (chat: ConversationMeta) => {
    setMenuFor(null);
    setEditingId(chat.id);
    setDraftTitle(chat.title || "New chat");
  };

  const commitRename = async () => {
    const id = editingId;
    const title = draftTitle.trim();
    setEditingId(null);
    if (!id || !user?.uid || !title) return;
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title, title_custom: true } : c)));
    try {
      await renameConversation(user.uid, id, title);
    } catch {
      refresh();
    }
  };

  if (!user?.uid) return null;

  const pinned = chats.filter((c) => c.pinned);
  const rest = chats.filter((c) => !c.pinned);

  const renderRow = (c: ConversationMeta) => {
    const active = c.id === activeId;
    const editing = c.id === editingId;

    if (editing) {
      return (
        <div key={c.id} className="flex items-center" style={{ gap: 6, padding: "4px 6px 4px 11px" }}>
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditingId(null);
            }}
            onBlur={commitRename}
            maxLength={80}
            aria-label="Chat name"
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--input-bg, var(--surface-elevated))",
              border: "1px solid var(--lime-400)",
              borderRadius: 8,
              padding: "6px 8px",
              fontSize: 13,
              color: "var(--text-primary)",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitRename}
            aria-label="Save name"
            className="cl-hist-icon"
            style={{ color: "var(--lime-400)" }}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditingId(null)}
            aria-label="Cancel rename"
            className="cl-hist-icon"
          >
            <X size={14} />
          </button>
        </div>
      );
    }

    return (
      <div key={c.id} className="cl-chatrow" style={{ position: "relative" }}>
        <Link
          href={`/?c=${c.id}`}
          onClick={onNavigate}
          className="flex items-center"
          title={c.title || "New chat"}
          style={{
            gap: 9,
            padding: "9px 34px 9px 11px",
            borderRadius: 9,
            textDecoration: "none",
            color: active ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: active ? 600 : 500,
            ...(active ? { background: "var(--surface-elevated)" } : {}),
          }}
        >
          {c.pinned ? (
            <Pin size={13} style={{ flex: "none", color: "var(--lime-400)" }} fill="currentColor" />
          ) : (
            <MessageSquare size={14} style={{ flex: "none", color: active ? "var(--lime-400)" : "var(--text-tertiary)" }} />
          )}
          <span className="truncate" style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
            {c.title || "New chat"}
          </span>
        </Link>

        <button
          type="button"
          aria-label="Chat options"
          aria-haspopup="menu"
          aria-expanded={menuFor === c.id}
          className="cl-chatmenu"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => setMenuFor((m) => (m === c.id ? null : c.id))}
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            width: 26,
            height: 26,
            borderRadius: 7,
            border: "none",
            background: "transparent",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MoreVertical size={14} />
        </button>

        {menuFor === c.id && (
          <div
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              right: 4,
              top: "calc(100% - 2px)",
              zIndex: 60,
              minWidth: 156,
              padding: 5,
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 11,
              boxShadow: "var(--shadow-card)",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <MenuItem icon={c.pinned ? <PinOff size={14} /> : <Pin size={14} />} onClick={() => handleTogglePin(c)}>
              {c.pinned ? "Unpin" : "Pin to top"}
            </MenuItem>
            <MenuItem icon={<Pencil size={14} />} onClick={() => startRename(c)}>
              Rename
            </MenuItem>
            <MenuItem icon={<Trash2 size={14} />} danger onClick={() => handleDelete(c.id)}>
              Delete
            </MenuItem>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="cl-chats" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, marginTop: 20 }}>
      <div className="flex items-center justify-between" style={{ padding: "0 11px 6px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--text-tertiary)" }}>
          Chats
        </span>
        <Link href="/" onClick={onNavigate} aria-label="New chat" title="New chat" className="cl-newchat">
          <Plus size={16} />
        </Link>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {chats.length === 0 ? (
          <div style={{ padding: "5px 12px", fontSize: 12.5, color: "var(--text-tertiary)" }}>No chats yet</div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <GroupLabel>Pinned</GroupLabel>
                {pinned.map(renderRow)}
                {rest.length > 0 && <GroupLabel>Recent</GroupLabel>}
              </>
            )}
            {rest.map(renderRow)}
          </>
        )}
      </div>

      <style jsx>{`
        .cl-hist-icon {
          flex: none;
          width: 26px;
          height: 26px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 12px 3px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
      }}
    >
      {children}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="cl-menuitem"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "8px 10px",
        borderRadius: 8,
        border: "none",
        background: "transparent",
        color: danger ? "var(--error)" : "var(--text-primary)",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      {icon}
      {children}
    </button>
  );
}
