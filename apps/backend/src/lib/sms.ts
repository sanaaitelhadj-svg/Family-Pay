export interface SmsProvider {
  send(phone: string, code: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(phone: string, code: string): Promise<void> {
    console.log(`[SMS] ${phone} → OTP: ${code}`);
  }
}

class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private from: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID!;
    this.authToken = process.env.TWILIO_AUTH_TOKEN!;
    this.from = process.env.TWILIO_FROM_NUMBER!;
  }

  async send(phone: string, code: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: phone,
      From: this.from,
      Body: `Votre code FamilyPay : ${code}. Valable 5 minutes.`,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twilio error: ${err}`);
    }
  }
}

function createSmsProvider(): SmsProvider {
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  ) {
    return new TwilioSmsProvider();
  }
  return new ConsoleSmsProvider();
}

export const smsProvider = createSmsProvider();
