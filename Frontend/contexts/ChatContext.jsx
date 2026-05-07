import React, { createContext, useContext, useState, useEffect } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Add any chat-related state and functions here
    const sendMessage = async (message) => {
        // Implement send message logic
        setMessages(prev => [...prev, message]);
    };

    const value = {
        messages,
        sendMessage,
        isLoading,
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChat must be used within ChatProvider');
    return ctx;
}