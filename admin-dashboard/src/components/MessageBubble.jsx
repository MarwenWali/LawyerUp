import React from 'react';
import { format } from 'date-fns';
import { Paperclip, FileText, Image as ImageIcon, Download } from 'lucide-react';

function getFileIcon(mimeType) {
  if (!mimeType) return <Paperclip className="w-4 h-4 flex-shrink-0" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4 flex-shrink-0" />;
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 flex-shrink-0" />;
  return <Paperclip className="w-4 h-4 flex-shrink-0" />;
}

export default function MessageBubble({ message, isAdmin, isFirst, isLast, showAvatar }) {
  const isSent = isAdmin;
  const isImage = message.message_type === 'image';
  const isFile = message.message_type === 'file';
  const hasAttachment = isImage || isFile;

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
                <img 
                  src={message.sender.profile_photo_url.includes('?') ? message.sender.profile_photo_url : `${message.sender.profile_photo_url}?t=1`} 
                  alt="" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover" 
                />
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
        {/* ── Image attachment ── */}
        {isImage && message.attachment_url ? (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            style={borderRadiusStyle}
            className="overflow-hidden block"
          >
            <img
              src={message.attachment_url}
              alt={message.attachment_name || 'Image'}
              className="max-w-[260px] max-h-[200px] object-cover"
              title={message.created_at ? format(new Date(message.created_at), 'PPPp') : ''}
            />
          </a>
        ) : null}

        {/* ── File attachment ── */}
        {isFile && message.attachment_url ? (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            style={borderRadiusStyle}
            className={`flex items-center gap-2 px-4 py-3 text-[14px] no-underline ${
              isSent
                ? 'bg-[#0084FF] text-white hover:bg-[#0073E6]'
                : 'bg-[#E4E6EB] text-[#050505] hover:bg-[#D8DADF]'
            }`}
            title={message.created_at ? format(new Date(message.created_at), 'PPPp') : ''}
          >
            <span className={isSent ? 'text-white' : 'text-gray-600'}>
              {getFileIcon(message.attachment_type)}
            </span>
            <span className="truncate max-w-[160px]">{message.attachment_name || 'Attachment'}</span>
            <Download className={`w-4 h-4 flex-shrink-0 ${isSent ? 'text-white opacity-70' : 'text-gray-400'}`} />
          </a>
        ) : null}

        {/* ── Text content (can be a caption on top of attachment) ── */}
        {message.content ? (
          <div
            style={hasAttachment ? { borderRadius: '20px' } : borderRadiusStyle}
            className={`px-3.5 py-2 text-[14px] leading-[1.3] transition-colors duration-150 ${
              hasAttachment ? 'mt-1' : ''
            } ${
              isSent
                ? 'bg-[#0084FF] text-white'
                : 'bg-[#E4E6EB] text-[#050505]'
            }`}
            title={message.created_at ? format(new Date(message.created_at), 'PPPp') : ''}
          >
            {message.content}
          </div>
        ) : null}

        {/* If no text and only attachment, we still need at least the empty bubble for the text-only case */}
        {!message.content && !hasAttachment ? (
          <div
            style={borderRadiusStyle}
            className={`px-3.5 py-2 text-[14px] leading-[1.3] ${
              isSent ? 'bg-[#0084FF] text-white' : 'bg-[#E4E6EB] text-[#050505]'
            }`}
            title={message.created_at ? format(new Date(message.created_at), 'PPPp') : ''}
          >
            {/* Empty message placeholder */}
          </div>
        ) : null}

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
