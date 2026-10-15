import { useLayoutEffect,useId,useRef } from 'react';
import { X } from 'lucide-react';

// Native modal dialogs provide focus containment, Escape handling and focus return.
export default function DashboardSheet({ title,eyebrow,children,onClose,busy=false,navigation=false,returnFocusRef }) {
  const dialog = useRef(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    const previousFocus = returnFocusRef?.current || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      // Wait for React to re-enable the launching action before returning focus.
      queueMicrotask(() => { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll:true }); });
    };
  },[returnFocusRef]);
  function containTab(event) {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <dialog ref={dialog} className={`portal-sheet${navigation ? ' portal-sheet--navigation' : ''}`} aria-labelledby={titleId}
    onKeyDown={containTab}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="portal-sheet__inner">
      <header className="portal-sheet__header"><div><span className="portal-eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2></div><button type="button" className="portal-icon-button" aria-label="Close panel" disabled={busy} onClick={onClose}><X size={20}/></button></header>
      {children}
    </div>
  </dialog>;
}
