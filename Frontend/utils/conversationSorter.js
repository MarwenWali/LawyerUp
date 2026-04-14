/**
 * Conversation Sorting Utilities
 * Ensures admin conversations are pinned to top, others sorted by timestamp
 */

/**
 * Checks if a conversation is with an admin
 * @param {Object} conversation - Conversation object
 * @returns {boolean} True if conversation is with admin
 */
export function isAdminConversation(conversation) {
  if (!conversation) return false;
  
  return (
    conversation?.other_participant_role === 'admin' ||
    conversation?.receiver_role === 'admin' ||
    conversation?.other_participant?.role === 'admin'
  );
}

/**
 * Checks if an admin conversation already exists in the list
 * @param {Array} conversations - Array of conversation objects
 * @returns {boolean} True if admin conversation exists
 */
export function hasAdminConversation(conversations) {
  return (
    Array.isArray(conversations) && 
    conversations.some(isAdminConversation)
  );
}

/**
 * Sorts conversations with Admin pinned to top, then others by last_message_timestamp descending
 * @param {Array} conversations - Array of conversation objects
 * @param {string} currentUserId - Current user's ID (optional, for additional filtering)
 * @returns {Array} Sorted conversations
 */
export function sortConversationsWithAdminPin(conversations, currentUserId) {
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return [];
  }

  // Create a copy to avoid mutating original array
  const sorted = [...conversations];

  return sorted.sort((a, b) => {
    // Check if either conversation is with admin
    const aIsAdmin = isAdminConversation(a);
    const bIsAdmin = isAdminConversation(b);

    // Admin conversations always come first
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;

    // For same-type conversations (both admin or both non-admin),
    // sort by last_message_at descending (newest first)
    const aTime = new Date(
      a.last_message_at || 
      a.last_message?.created_at || 
      a.created_at
    ).getTime();
    
    const bTime = new Date(
      b.last_message_at || 
      b.last_message?.created_at || 
      b.created_at
    ).getTime();

    return bTime - aTime; // Newest first
  });
}

/**
 * Gets the role label for a conversation participant
 * @param {Object} conversation - Conversation object
 * @returns {string} Role label ('Support' for admin, 'Client' for citizen/user, 'Lawyer' for lawyer)
 */
export function getRoleLabel(conversation) {
  if (!conversation) return 'Participant';

  const role = 
    conversation?.other_participant_role || 
    conversation?.other_participant?.role ||
    'participant';

  const normalized = String(role).toLowerCase();

  if (normalized === 'admin') return 'Support';
  if (normalized === 'citizen' || normalized === 'user') return 'Client';
  if (normalized === 'lawyer') return 'Lawyer';

  return 'Participant';
}

/**
 * Gets the displayed title for a conversation
 * @param {Object} conversation - Conversation object
 * @returns {string} Display title
 */
export function getConversationTitle(conversation) {
  if (!conversation) return 'Conversation';

  // Try to get explicit name first
  if (conversation?.other_participant_name) {
    return conversation.other_participant_name;
  }

  if (conversation?.other_participant?.name) {
    return conversation.other_participant.name;
  }

  if (conversation?.other_participant?.full_name) {
    return conversation.other_participant.full_name;
  }

  // Fall back to role-based title
  const role = conversation?.other_participant_role || 
               conversation?.other_participant?.role;
  
  if (role === 'admin') return 'Admin Team';
  if (role === 'citizen' || role === 'user') return 'Client';
  if (role === 'lawyer') return 'Lawyer';

  return 'Conversation';
}

/**
 * Gets initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 chars)
 */
export function getInitials(name) {
  if (!name) return '?';
  
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join('')
    .slice(0, 2) || '?';
}
