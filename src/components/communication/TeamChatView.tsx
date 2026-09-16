import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Users,
  Shield,
  Clock,
  Check,
  CheckCheck,
  UserPlus,
  X,
  Lock,
  ChevronLeft,
  Circle,
  Building2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TeamConversationRecord, TeamMessageRecord, UserProfile, UserRole } from '../../types/database';
import {
  subscribeToConversations,
  subscribeToMessages,
  getOrCreateConversation,
  sendTeamMessage,
  markConversationAsRead,
  getConversationPartner,
  getLocalConversations,
  getLocalMessages,
} from '../../lib/teamChat';
import { getAllUsers, getEffectiveCompanyId, DEFAULT_COMPANY_ID } from '../../lib/dal';
import { LiquidButton } from '../liquid/LiquidButton';

interface TeamChatViewProps {
  initialConversationId?: string;
  onSelectConversation?: (convId: string) => void;
}

export const TeamChatView: React.FC<TeamChatViewProps> = ({
  initialConversationId,
  onSelectConversation,
}) => {
  const { userProfile, currentUser, isSuperAdmin } = useAuth();

  const currentUserId = userProfile?.id || currentUser?.uid || '';
  const currentUserName = userProfile?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Team Member';
  const currentUserRole = userProfile?.role || 'SALESMAN';
  const companyId = userProfile?.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;

  // Conversations & Messages state
  const [conversations, setConversations] = useState<TeamConversationRecord[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<TeamMessageRecord[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Team directory for new chat modal
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState<boolean>(false);
  const [newChatSearch, setNewChatSearch] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Strictly enforce tenant and role boundaries
  const isCustomer = currentUserRole === 'CUSTOMER';

  // 1. Subscribe to real-time company conversations
  useEffect(() => {
    if (isSuperAdmin || isCustomer || !currentUserId || !companyId) return;

    const unsub = subscribeToConversations(
      companyId,
      currentUserId,
      currentUserRole,
      (convs) => {
        setConversations(convs);
        // Auto-select first conversation if none selected on desktop
        if (!selectedConvId && convs.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
          setSelectedConvId(convs[0].id);
        }
      }
    );

    return () => unsub();
  }, [companyId, currentUserId, currentUserRole, isSuperAdmin, isCustomer]);

  // 2. Subscribe to real-time messages for active conversation
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    const unsub = subscribeToMessages(selectedConvId, (msgs) => {
      setMessages(msgs);
      // Auto mark as read
      markConversationAsRead(selectedConvId, currentUserId).catch(() => {});
    });

    return () => unsub();
  }, [selectedConvId, currentUserId]);

  // 3. Auto-scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Load company team members for new conversation initiation
  useEffect(() => {
    if (isSuperAdmin || isCustomer) return;
    getAllUsers()
      .then((users) => {
        // Filter strictly to current company, excluding current user, customer accounts, and super admins
        const companyTeam = users.filter((u) => {
          const uComp = u.company_id || DEFAULT_COMPANY_ID;
          const isCompMatch = uComp === companyId;
          const isInternalRole = u.role === 'ADMIN' || u.role === 'SALESMAN';
          const isSelf = u.id === currentUserId || u.email?.toLowerCase() === currentUser?.email?.toLowerCase();
          return isCompMatch && isInternalRole && !isSelf && u.is_active !== false;
        });
        setTeamUsers(companyTeam);
      })
      .catch((err) => console.warn('Team chat user directory error:', err));
  }, [companyId, currentUserId, currentUser?.email, isSuperAdmin, isCustomer]);

  // Handle message submission
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConvId || !inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      await sendTeamMessage(
        selectedConvId,
        companyId,
        currentUserId,
        currentUserName,
        currentUserRole,
        textToSend
      );
    } catch (err) {
      console.error('Failed to send team message:', err);
      // Restore input on failure
      setInputText(textToSend);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Start new conversation with a team member
  const handleStartChatWith = async (targetUser: UserProfile) => {
    try {
      const conv = await getOrCreateConversation(
        companyId,
        currentUserId,
        currentUserName,
        currentUserRole,
        targetUser.id,
        targetUser.full_name,
        targetUser.role
      );
      setIsNewChatModalOpen(false);
      setSelectedConvId(conv.id);
      if (onSelectConversation) {
        onSelectConversation(conv.id);
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  // Filtered conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const partner = getConversationPartner(c, currentUserId);
      const nameMatch = partner.name.toLowerCase().includes(q);
      const previewMatch = c.last_message_preview?.toLowerCase().includes(q);
      return nameMatch || previewMatch;
    });
  }, [conversations, searchQuery, currentUserId]);

  // Selected conversation object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvId) || null;
  }, [conversations, selectedConvId]);

  const activePartner = activeConversation ? getConversationPartner(activeConversation, currentUserId) : null;

  // Render Access Control Restrictions
  if (isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Tenant Isolation Enforced</h3>
        <p className="mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
          Platform Super Administrators do not have access to company-scoped internal team conversations. Tenant privacy and communications remain isolated to company employees.
        </p>
      </div>
    );
  }

  if (isCustomer) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4 border border-rose-200">
          <Shield className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Internal Employee Hub</h3>
        <p className="mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
          Team communication is an internal collaboration tool restricted to authorized company administrators and sales representatives.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col md:flex-row h-[750px] max-h-[calc(100vh-180px)] w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* =========================================================================
          LEFT SIDEBAR: Conversation List & Directory
          ========================================================================= */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-200 bg-slate-50/50 ${
          selectedConvId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Left Header */}
        <div className="p-4 border-b border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-sm">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Team Chat</h2>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-medium text-slate-500">
                    {currentUserRole === 'ADMIN' ? 'Company Admin' : 'Sales Representative'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              id="team-chat-new-msg-btn"
              onClick={() => setIsNewChatModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              title="Start conversation with team member"
            >
              <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">No conversations yet</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  Start a direct internal thread with any company salesman or admin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Start Conversation</span>
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const partner = getConversationPartner(conv, currentUserId);
              const isSelected = conv.id === selectedConvId;
              const hasUnread =
                conv.last_message_sender_id &&
                conv.last_message_sender_id !== currentUserId;

              // Format date
              const timeStr = conv.last_message_at
                ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    setSelectedConvId(conv.id);
                    if (onSelectConversation) onSelectConversation(conv.id);
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/80 border border-emerald-200/80 text-slate-900 shadow-2xs'
                      : 'hover:bg-slate-100/70 text-slate-700'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 font-bold text-xs text-white shadow-xs">
                      {partner.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || 'TM'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{partner.name}</p>
                      <span className="text-[10px] text-slate-400 shrink-0">{timeStr}</span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          partner.role?.toUpperCase() === 'ADMIN'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {partner.role || 'Salesman'}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500 truncate leading-tight">
                      {conv.last_message_preview || (
                        <span className="italic text-slate-400">Thread opened</span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* =========================================================================
          RIGHT PANEL: Active Chat Thread Stream & Input
          ========================================================================= */}
      <div
        className={`flex-1 flex flex-col bg-white ${
          !selectedConvId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConversation && activePartner ? (
          <>
            {/* Thread Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-white">
              <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <button
                  type="button"
                  onClick={() => setSelectedConvId(null)}
                  className="md:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition"
                  title="Back to conversations"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 font-bold text-xs text-white shadow-xs">
                  {activePartner.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'TM'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{activePartner.name}</h3>
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        activePartner.role?.toUpperCase() === 'ADMIN'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {activePartner.role || 'Salesman'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-slate-400" />
                    <span>Company Tenant Thread • Encrypted & Isolated</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <Lock className="h-3 w-3" />
                  <span className="hidden sm:inline">Internal Only</span>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Direct Communication Channel</h4>
                  <p className="max-w-xs text-xs text-slate-500 leading-relaxed">
                    Say hello to {activePartner.name}. Discuss lead pipelines, sales strategies, and internal updates securely.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  const isRead = msg.read_by && msg.read_by.length > 1;
                  const msgTime = new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      {/* Sender label for incoming messages */}
                      {!isMe && (
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[10px] font-bold text-slate-700">{msg.sender_name}</span>
                          <span className="text-[9px] font-medium text-slate-400 uppercase">
                            ({msg.sender_role})
                          </span>
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs break-words ${
                          isMe
                            ? 'bg-emerald-600 text-white rounded-br-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>

                      {/* Timestamp & Read Receipt */}
                      <div
                        className={`flex items-center gap-1 mt-1 px-1 text-[10px] ${
                          isMe ? 'text-slate-400 justify-end' : 'text-slate-400 justify-start'
                        }`}
                      >
                        <span>{msgTime}</span>
                        {isMe && (
                          <span title={isRead ? 'Read by team member' : 'Delivered'}>
                            {isRead ? (
                              <CheckCheck className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Check className="h-3 w-3 text-slate-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer */}
            <div className="border-t border-slate-200 bg-white p-3">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <div className="flex-1 rounded-xl border border-slate-300 bg-slate-50/50 p-2 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-500 transition">
                  <textarea
                    ref={inputRef}
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${activePartner.name}...`}
                    className="w-full resize-none bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-400">
                    <span>Press <kbd className="font-mono font-semibold">Enter</kbd> to send, <kbd className="font-mono font-semibold">Shift+Enter</kbd> for newline</span>
                    <span className="text-[10px] text-slate-400">{inputText.length} chars</span>
                  </div>
                </div>

                <LiquidButton
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="h-11 px-4 rounded-xl shrink-0 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </LiquidButton>
              </form>
            </div>
          </>
        ) : (
          /* Empty State when no conversation selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mb-3 shadow-xs">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">ZaynOps Team Communication Hub</h3>
            <p className="mt-1.5 max-w-sm text-xs text-slate-500 leading-relaxed">
              Select an ongoing thread from the list or start a new conversation with any company admin or sales representative.
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Start New Conversation</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: Start New Conversation with Company Team Member
          ========================================================================= */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">New Conversation</h3>
                  <p className="text-[11px] text-slate-500">Connect with company team members</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Team Directory */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
                placeholder="Search team members by name or email..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Team Directory List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {teamUsers.filter((u) => {
                if (!newChatSearch.trim()) return true;
                const q = newChatSearch.toLowerCase();
                return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
              }).length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No other active team members found in this company.
                </div>
              ) : (
                teamUsers
                  .filter((u) => {
                    if (!newChatSearch.trim()) return true;
                    const q = newChatSearch.toLowerCase();
                    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                  })
                  .map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleStartChatWith(user)}
                      className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50 rounded-xl transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 font-bold text-xs text-white">
                          {user.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{user.full_name}</p>
                          <p className="text-[11px] text-slate-500">{user.email}</p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          user.role === 'ADMIN'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {user.role}
                      </span>
                    </button>
                  ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
