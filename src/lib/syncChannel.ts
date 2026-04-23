/**
 * Hybrid Sync Channel
 * Uses Electron IPC when available for solid production stability.
 * Falls back to BroadcastChannel for web-only preview testing.
 */

// Instantiate a single fallback BroadcastChannel
const fallbackBc = typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined' 
  ? new BroadcastChannel('karaoke-sync') 
  : null;

/**
 * Sends a message across all open windows (Projectors & Operator)
 */
export const sendSyncMessage = (data: any) => {
  if (window.electronAPI) {
    window.electronAPI.send('karaoke-sync-out', data);
  } else if (fallbackBc) {
    fallbackBc.postMessage(data);
  }
};

/**
 * Subscribes to incoming sync messages. Returns a cleanup function.
 */
export const subscribeSyncMessages = (callback: (data: any) => void) => {
  if (window.electronAPI) {
    window.electronAPI.receive('karaoke-sync-in', callback);
    return () => {
      if (window.electronAPI?.removeListener) {
         window.electronAPI.removeListener('karaoke-sync-in', callback);
      }
    };
  } else if (fallbackBc) {
    const handleMessage = (e: MessageEvent) => callback(e.data);
    fallbackBc.addEventListener('message', handleMessage);
    return () => fallbackBc.removeEventListener('message', handleMessage);
  }
  
  // Return empty cleanup if neither is available
  return () => {};
};
