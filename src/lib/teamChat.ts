/**
 * Team Communication Hub Data Access Layer
 * Internal company-scoped 1-to-1 messaging between Admins and Salesmen.
 * Strictly isolated by company_id. Platform Admins and Customers are forbidden.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { TeamConversationRecord, TeamMessageRecord, UserRole } from '../types/database';
import { createNotification, getEffectiveCompanyId } from './dal';

export const LOCAL_STORAGE_CONVERSATIONS_KEY = 'crm_local_conversations_v1';
export const LOCAL_STORAGE_MESSAGES_KEY = 'crm_local_messages_v1';

// Custom DOM event dispatchers for instant reactivity
export function notifyConversationsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_conversations_changed'));
  }
}

export function notifyMessagesChanged(conversationId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('crm_messages_changed', { detail: { conversationId } })
    );
  }
}

export function getLocalConversations(): TeamConversationRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function setLocalConversations(list: TeamConversationRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function getLocalMessages(): TeamMessageRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function setLocalMessages(list: TeamMessageRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_MESSAGES_KEY, JSON.stringify(list));
  } catch (e) {}
}

/**
 * Subscribes to company conversations for the given user.
 * - Admin sees all conversations they are in (or all within their company)
 * - Salesman sees only conversations they participate in.
 */
export function subscribeToConversations(
  companyId: string,
  userId: string,
  userRole: UserRole | string,
  onUpdate: (conversations: TeamConversationRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const safeRole = (userRole || '').toUpperCase();
  const isAdmin = safeRole === 'ADMIN';

  const filterAndEmit = (list: TeamConversationRecord[]) => {
    const filtered = list
      .filter((c) => {
        if (c.company_id !== companyId) return false;
        if (isAdmin) {
          // Admin can see conversations involving them or all company team chats
          return c.participant_ids?.includes(userId) || true;
        }
        // Salesman: only conversations where they are a participant
        return c.participant_ids?.includes(userId);
      })
      .sort((a, b) => {
        const timeA = new Date(a.last_message_at || a.created_at).getTime();
        const timeB = new Date(b.last_message_at || b.created_at).getTime();
        return timeB - timeA;
      });
    onUpdate(filtered);
  };

  // 1. Instant local push
  filterAndEmit(getLocalConversations());

  // 2. Local custom event listener
  const handleLocalChange = () => {
    filterAndEmit(getLocalConversations());
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('crm_conversations_changed', handleLocalChange);
  }

  // 3. Real-time Firestore onSnapshot
  let firestoreUnsub: Unsubscribe = () => {};
  try {
    const convCol = collection(db, 'conversations');
    // Query scoped to company
    const q = query(convCol, where('company_id', '==', companyId));

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsConvs: TeamConversationRecord[] = [];
        snapshot.forEach((d) => {
          fsConvs.push({ id: d.id, ...d.data() } as TeamConversationRecord);
        });

        // Merge with local storage
        const currentLocal = getLocalConversations();
        const map = new Map<string, TeamConversationRecord>();
        currentLocal.forEach((c) => map.set(c.id, c));
        fsConvs.forEach((c) => map.set(c.id, c));

        const merged = Array.from(map.values());
        setLocalConversations(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore subscribeToConversations fallback notice:', err);
        filterAndEmit(getLocalConversations());
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore conversations listener:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_conversations_changed', handleLocalChange);
    }
  };
}

/**
 * Subscribes to real-time messages within a single conversation.
 */
export function subscribeToMessages(
  conversationId: string,
  onUpdate: (messages: TeamMessageRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const filterAndEmit = (list: TeamMessageRecord[]) => {
    const filtered = list
      .filter((m) => m.conversation_id === conversationId && !m.deleted_at)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    onUpdate(filtered);
  };

  // 1. Instant local push
  filterAndEmit(getLocalMessages());

  // 2. Local custom event listener
  const handleLocalChange = (e: any) => {
    if (!e.detail || !e.detail.conversationId || e.detail.conversationId === conversationId) {
      filterAndEmit(getLocalMessages());
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('crm_messages_changed', handleLocalChange);
  }

  // 3. Real-time Firestore onSnapshot
  let firestoreUnsub: Unsubscribe = () => {};
  try {
    const msgsCol = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgsCol, orderBy('created_at', 'asc'));

    firestoreUnsub = onSnapshot(
      q,
      (snapshot) => {
        const fsMsgs: TeamMessageRecord[] = [];
        snapshot.forEach((d) => {
          fsMsgs.push({ id: d.id, ...d.data() } as TeamMessageRecord);
        });

        const currentLocal = getLocalMessages();
        const otherLocal = currentLocal.filter((m) => m.conversation_id !== conversationId);
        const map = new Map<string, TeamMessageRecord>();
        currentLocal.filter((m) => m.conversation_id === conversationId).forEach((m) => map.set(m.id, m));
        fsMsgs.forEach((m) => map.set(m.id, m));

        const merged = [...otherLocal, ...Array.from(map.values())];
        setLocalMessages(merged);
        filterAndEmit(merged);
      },
      (err) => {
        console.warn('Firestore subscribeToMessages fallback notice:', err);
        filterAndEmit(getLocalMessages());
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.warn('Could not establish Firestore messages listener:', e);
  }

  return () => {
    firestoreUnsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_messages_changed', handleLocalChange);
    }
  };
}

/**
 * Finds an existing 1-to-1 conversation between two users in the company,
 * or creates a new one if it doesn't exist yet.
 * Never creates duplicate parallel conversations between the same two users.
 */
export async function getOrCreateConversation(
  companyId: string,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: string,
  targetUserId: string,
  targetUserName: string,
  targetUserRole: string
): Promise<TeamConversationRecord> {
  if (currentUserId === targetUserId) {
    throw new Error('Self-conversations are not supported.');
  }

  const localConvs = getLocalConversations();
  const existing = localConvs.find(
    (c) =>
      c.company_id === companyId &&
      c.participant_ids?.includes(currentUserId) &&
      c.participant_ids?.includes(targetUserId)
  );

  if (existing) {
    return existing;
  }

  // Also query Firestore to prevent duplicate creation
  try {
    const convCol = collection(db, 'conversations');
    const q = query(convCol, where('company_id', '==', companyId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as TeamConversationRecord;
      if (
        data.participant_ids?.includes(currentUserId) &&
        data.participant_ids?.includes(targetUserId)
      ) {
        const found = { id: d.id, ...data };
        const updatedLocal = [found, ...localConvs.filter((c) => c.id !== d.id)];
        setLocalConversations(updatedLocal);
        notifyConversationsChanged();
        return found;
      }
    }
  } catch (err) {
    console.warn('Firestore getOrCreateConversation search fallback notice:', err);
  }

  // Create new conversation
  const now = new Date().toISOString();
  const generatedId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const newConv: TeamConversationRecord = {
    id: generatedId,
    company_id: companyId,
    participant_ids: [currentUserId, targetUserId],
    participant_names: {
      [currentUserId]: currentUserName,
      [targetUserId]: targetUserName,
    },
    participant_roles: {
      [currentUserId]: currentUserRole,
      [targetUserId]: targetUserRole,
    },
    created_at: now,
    updated_at: now,
    created_by: currentUserId,
  };

  // Immediate save to local cache
  setLocalConversations([newConv, ...localConvs]);
  notifyConversationsChanged();

  // Async sync to Firestore
  try {
    const convCol = collection(db, 'conversations');
    const { id, ...saveData } = newConv;
    const docRef = await addDoc(convCol, saveData);
    if (docRef.id) {
      newConv.id = docRef.id;
      const updatedLocal = getLocalConversations().map((c) => (c.id === generatedId ? newConv : c));
      setLocalConversations(updatedLocal);
      notifyConversationsChanged();
    }
  } catch (err) {
    console.warn('Firestore addDoc conversation notice:', err);
  }

  return newConv;
}

/**
 * Sends a message in a team conversation.
 * Updates conversation's last_message metadata and triggers in-app notifications to recipients.
 */
export async function sendTeamMessage(
  conversationId: string,
  companyId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  messageText: string
): Promise<TeamMessageRecord> {
  const trimmed = messageText.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty.');
  }

  const now = new Date().toISOString();
  const generatedId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const newMsg: TeamMessageRecord = {
    id: generatedId,
    company_id: companyId,
    conversation_id: conversationId,
    sender_id: senderId,
    sender_name: senderName,
    sender_role: senderRole,
    message: trimmed,
    created_at: now,
    read_by: [senderId], // Sender has automatically read their own message
  };

  // 1. Update local messages
  const localMsgs = getLocalMessages();
  setLocalMessages([...localMsgs, newMsg]);
  notifyMessagesChanged(conversationId);

  // 2. Update conversation preview
  const preview = trimmed.length > 80 ? trimmed.substring(0, 77) + '...' : trimmed;
  const localConvs = getLocalConversations();
  const targetConv = localConvs.find((c) => c.id === conversationId);
  const updatedConvs = localConvs.map((c) => {
    if (c.id === conversationId) {
      return {
        ...c,
        last_message_at: now,
        last_message_preview: preview,
        last_message_sender_id: senderId,
        last_message_sender_name: senderName,
        updated_at: now,
      };
    }
    return c;
  });
  setLocalConversations(updatedConvs);
  notifyConversationsChanged();

  // 3. Async sync to Firestore
  try {
    const msgsCol = collection(db, 'conversations', conversationId, 'messages');
    const { id, ...msgData } = newMsg;
    const docRef = await addDoc(msgsCol, msgData);
    if (docRef.id) {
      newMsg.id = docRef.id;
      const refreshed = getLocalMessages().map((m) => (m.id === generatedId ? newMsg : m));
      setLocalMessages(refreshed);
      notifyMessagesChanged(conversationId);
    }

    // Update conversation document
    const convDocRef = doc(db, 'conversations', conversationId);
    await updateDoc(convDocRef, {
      last_message_at: now,
      last_message_preview: preview,
      last_message_sender_id: senderId,
      last_message_sender_name: senderName,
      updated_at: now,
    });
  } catch (err) {
    console.warn('Firestore sendTeamMessage notice:', err);
  }

  // 4. In-App Notification for recipient(s)
  if (targetConv?.participant_ids) {
    const recipients = targetConv.participant_ids.filter((uid) => uid !== senderId);
    for (const recipientId of recipients) {
      try {
        await createNotification({
          recipient_id: recipientId,
          type: 'general',
          title: `${senderName} sent you a message`,
          message: preview,
          link_url: `/communication-hub?conv=${conversationId}`,
          event_key: `team_msg_${newMsg.id}_${recipientId}`,
        });
      } catch (nErr) {
        console.warn('Failed to send message notification:', nErr);
      }
    }
  }

  return newMsg;
}

/**
 * Marks all messages in a conversation as read by the current user.
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const localMsgs = getLocalMessages();
  let changed = false;

  const unreadMsgIds: string[] = [];
  const updatedMsgs = localMsgs.map((m) => {
    if (m.conversation_id === conversationId && !m.read_by?.includes(userId)) {
      changed = true;
      unreadMsgIds.push(m.id);
      return {
        ...m,
        read_by: [...(m.read_by || []), userId],
      };
    }
    return m;
  });

  if (changed) {
    setLocalMessages(updatedMsgs);
    notifyMessagesChanged(conversationId);
    notifyConversationsChanged();
  }

  // Sync to Firestore for unread messages
  if (unreadMsgIds.length > 0) {
    for (const msgId of unreadMsgIds) {
      try {
        const msgDocRef = doc(db, 'conversations', conversationId, 'messages', msgId);
        const msgSnap = await getDoc(msgDocRef);
        if (msgSnap.exists()) {
          const currentRead = (msgSnap.data().read_by as string[]) || [];
          if (!currentRead.includes(userId)) {
            await updateDoc(msgDocRef, {
              read_by: [...currentRead, userId],
            });
          }
        }
      } catch (err) {
        // Non-blocking
      }
    }
  }
}

/**
 * Subscribes to the live unread count of team messages for a user.
 * Used for live badges on navigation/sidebar.
 */
export function subscribeToUnreadTeamMessages(
  companyId: string,
  userId: string,
  onCountUpdate: (count: number) => void
): Unsubscribe {
  const computeCount = () => {
    const localConvs = getLocalConversations().filter(
      (c) => c.company_id === companyId && c.participant_ids?.includes(userId)
    );
    const convIds = new Set(localConvs.map((c) => c.id));
    const localMsgs = getLocalMessages();
    const unread = localMsgs.filter(
      (m) =>
        convIds.has(m.conversation_id) &&
        m.sender_id !== userId &&
        !m.read_by?.includes(userId) &&
        !m.deleted_at
    );
    onCountUpdate(unread.length);
  };

  computeCount();

  const handleUpdate = () => {
    computeCount();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_conversations_changed', handleUpdate);
    window.addEventListener('crm_messages_changed', handleUpdate);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_conversations_changed', handleUpdate);
      window.removeEventListener('crm_messages_changed', handleUpdate);
    }
  };
}

/**
 * Returns the counterpart user info in a 1-to-1 conversation
 */
export function getConversationPartner(
  conversation: TeamConversationRecord,
  currentUserId: string
): { id: string; name: string; role?: string } {
  const otherId = conversation.participant_ids?.find((uid) => uid !== currentUserId) || '';
  const name = conversation.participant_names?.[otherId] || 'Team Member';
  const role = conversation.participant_roles?.[otherId] || 'Member';
  return { id: otherId, name, role };
}
