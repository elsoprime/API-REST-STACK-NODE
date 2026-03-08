export interface EmailVerificationDeliveryPayload {
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
}

export interface EmailVerificationDeliveryPort {
  deliver: (payload: EmailVerificationDeliveryPayload) => Promise<void>;
}
