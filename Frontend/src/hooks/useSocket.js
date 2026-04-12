import { useChatContext } from '@/src/contexts/ChatContext';

export function useSocket() {
  return useChatContext();
}
