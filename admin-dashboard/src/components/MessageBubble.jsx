import React from 'react';
import { format } from 'date-fns';

export default function MessageBubble({ message, isAdmin, isFirst, isLast, showAvatar }) {
  const isSent = isAdmin;
  
  // Messenger-style corner radii logic
  const borderRadiusStyle = isSent
    ? {
        borderTopLeftRadius: '20px',
        borderBottomLeftRadius: '20px',
        borderTopRightRadius: isFirst ? '20px' : '4px',
        borderBottomRightRadius: isLast ? '20px' : '4px',
      }
    : {
        borderTopRightRadius: '20px',
        borderBottomRightRadius: '20px',
        borderTopLeftRadius: isFirst ? '20px' : '4px',
        borderBottomLeftRadius: isLast ? '20px' : '4px',
      };

  return (
    <div className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'} ${isLast ? 'mb-4' : 'mb-1'}`}>
      {!isSent && (
        <div className="w-8 flex-shrink-0 mr-2 flex flex-col justify-end">
          {showAvatar ? (
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 overflow-hidden border border-gray-100">
              {message.sender?.profile_photo_url ? (
                <img src={message.sender.profile_photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (message.sender?.name || 'L').charAt(0)
              )}
            </div>
          ) : (
            <div className="w-7" />
          )}
        </div>
      )}

      <div className={`group relative max-w-[70%] flex flex-col ${isSent ? 'items-end' : 'items-start'}`}>
        <div 
          style={borderRadiusStyle}
          className={`px-3.5 py-2 text-[14px] leading-[1.3] transition-colors duration-150 ${
            isSent 
              ? 'bg-[#0084FF] text-white' 
              : 'bg-[#E4E6EB] text-[#050505]'
          }`}
          title={message.created_at ? format(new Date(message.created_at), 'PPPp') : ''}
        >
          {message.content}
        </div>
        
        {isLast && (
          <div className={`mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
             <span className="text-[10px] text-gray-400 font-normal">
              {message.created_at ? format(new Date(message.created_at), 'HH:mm') : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
