// Phase 3 boundary only. No inbox, fan-out, or delivery claims.
import { EventEmitter } from 'node:events';
export const communityEvents = new EventEmitter();
export function emitReplyCreated(event) {
 for (const listener of communityEvents.listeners('community.reply_created')) {
  try { Promise.resolve(listener(Object.freeze({...event}))).catch(error => console.error('Community event subscriber failed.',error.message)); }
  catch (error) { console.error('Community event subscriber failed.',error.message); }
 }
}
