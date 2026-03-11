export interface EmailVerificationDeliveryPayload {
  userId: string;
  email: string;
  firstName?: string | null;
  token: string;
  expiresAt: string;
}

export interface EmailVerificationDeliveryPort {
  deliver: (payload: EmailVerificationDeliveryPayload) => Promise<void>;
}
