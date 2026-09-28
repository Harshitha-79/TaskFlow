import { useEffect, useRef } from 'react';
import { subscribe, onOpen } from '../services/socket';

// handler(msg) runs on each event; onReconnect() runs whenever the socket (re)opens, to resync state.
export default function useLiveEvents(handler, onReconnect) {
  const h = useRef(handler);
  const r = useRef(onReconnect);
  useEffect(() => { h.current = handler; r.current = onReconnect; });
  useEffect(() => {
    const a = subscribe((m) => h.current && h.current(m));
    const b = onOpen(() => r.current && r.current());
    return () => { a(); b(); };
  }, []);
}