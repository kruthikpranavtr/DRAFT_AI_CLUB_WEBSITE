import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, MessageSquare } from 'lucide-react';

export default function Modal({ isOpen, onClose, data }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const chatQuery = encodeURIComponent(`Tell me more about the ${data.title || 'AI Club activity'}`);

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div className="modal-back" onClick={onClose} />
      <div className="modal-card">
        <button className="modal-x" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </button>

        {data.img && (
          <img src={data.img} alt={data.title || 'Preview'} loading="lazy" />
        )}

        <div className="m-body">
          {data.cat && <span className="cat mono">{data.cat}</span>}
          <h3 id="modalTitle">{data.title}</h3>
          {data.meta && <div className="meta mono">{data.meta}</div>}
          <p>{data.text}</p>

          <div style={{ marginTop: '22px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              to={`/chat?q=${chatQuery}`}
              className="btn btn-gho btn-sm"
              onClick={onClose}
            >
              <MessageSquare size={15} /> Ask Assistant About This
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
