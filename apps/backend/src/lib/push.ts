export async function sendExpoPush(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!pushToken.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data: data ?? {}, sound: 'default', priority: 'high' }),
    });
  } catch (err: any) { console.error('[sendExpoPush]', err?.message); }
}
