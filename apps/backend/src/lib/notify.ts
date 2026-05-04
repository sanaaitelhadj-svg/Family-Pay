/**
 * Notifications WebSocket — fire-and-forget, silencieux si socket non initialisé (tests).
 * Les clients rejoignent leur room via socket.on('join:user', userId).
 */
export function notifyUser(userId: string, event: string, data: unknown): void {
  setImmediate(async () => {
    try {
      const { getIO } = await import('../socket.js');
      getIO().to(`user:${userId}`).emit(event, data);
    } catch { /* socket non initialisé en test ou dev sans WS */ }
  });
}
