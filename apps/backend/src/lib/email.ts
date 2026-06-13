export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const token   = process.env.MAILTRAP_TOKEN;
  const inboxId = process.env.MAILTRAP_INBOX_ID;

  if (!token || !inboxId) throw new Error('MAILTRAP_TOKEN ou MAILTRAP_INBOX_ID manquant');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#F9FAFB;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#5B3DF5;font-size:24px;margin:0;">FamilyPay</h1>
        <p style="color:#6B7280;margin:4px 0 0;">Réinitialisation de mot de passe</p>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #E5E7EB;">
        <p style="color:#111827;margin:0 0 16px;">Voici votre code de vérification :</p>
        <div style="background:#F0EDFF;border-radius:8px;padding:20px;text-align:center;margin:16px 0;">
          <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#5B3DF5;">${code}</span>
        </div>
        <p style="color:#6B7280;font-size:13px;margin:16px 0 0;">⏱ Ce code expire dans <strong>10 minutes</strong>.</p>
        <p style="color:#6B7280;font-size:13px;margin:8px 0 0;">🔒 Ne partagez jamais ce code.</p>
      </div>
      <p style="color:#9CA3AF;font-size:11px;text-align:center;margin-top:16px;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
      </p>
    </div>
  `;

  const response = await fetch(`https://sandbox.api.mailtrap.io/api/send/${inboxId}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    { email: 'noreply@familypay.ma', name: 'FamilyPay' },
      to:      [{ email }],
      subject: '🔐 FamilyPay — Réinitialisation de votre mot de passe',
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Mailtrap API error ${response.status}: ${err}`);
  }
}
// cache-bust Sat Jun 13 12:35:24 UTC 2026
