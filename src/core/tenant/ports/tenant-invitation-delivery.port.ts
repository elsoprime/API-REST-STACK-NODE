export interface TenantInvitationDeliveryPayload {
  tenantId: string;
  email: string;
  token: string;
  roleKey: string;
  expiresAt: string;
}

export interface TenantInvitationDeliveryPort {
  deliver: (payload: TenantInvitationDeliveryPayload) => Promise<void>;
}
