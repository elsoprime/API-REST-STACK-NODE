export interface TwoFactorProvisioningPayload {
  userId: string;
  email: string;
  secret: string;
  otpauthUrl: string;
}

export interface TwoFactorProvisioningPort {
  deliver: (payload: TwoFactorProvisioningPayload) => Promise<void>;
}
