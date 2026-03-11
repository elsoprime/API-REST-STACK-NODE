export interface PasswordResetDeliveryPayload {
  userId: string;
  email: string;
  firstName?: string | null;
  token: string;
  expiresAt: string;
}

export interface PasswordResetDeliveryPort {
  deliver: (payload: PasswordResetDeliveryPayload) => Promise<void>;
}
