import { EmailTemplateService } from '@/core/communications/email/services/email-template.service';

describe('EmailTemplateService', () => {
  const service = new EmailTemplateService();

  it('renders the verify-email template with subject, html and text', () => {
    const result = service.render({
      key: 'verify-email',
      variables: {
        applicationName: 'SaaS Core Engine',
        recipientEmail: 'john@example.com',
        recipientFirstName: 'John',
        verificationUrl: 'https://app.example.com/auth/verify-email?token=abc',
        expiresAt: '2026-03-08T00:00:00.000Z',
        supportEmail: 'support@example.com'
      }
    });

    expect(result.version).toBe('1.1.0');
    expect(result.subject).toContain('Verifica tu correo');
    expect(result.html).toContain('lang="es"');
    expect(result.html).toContain('Verificar correo');
    expect(result.html).toContain('Correo registrado');
    expect(result.html).toContain('https://app.example.com/auth/verify-email?token=abc');
    expect(result.text).toContain('Recibimos una solicitud para verificar el correo');
    expect(result.text).toContain('support@example.com');
  });

  it('renders the tenant invitation template with a role label and acceptance URL', () => {
    const result = service.render({
      key: 'tenant-invitation',
      variables: {
        applicationName: 'SaaS Core Engine',
        recipientEmail: 'member@example.com',
        tenantName: 'Acme',
        invitationUrl: 'https://app.example.com/tenant/invitations/accept?token=abc',
        roleLabel: 'Member',
        expiresAt: '2026-03-08T00:00:00.000Z',
        supportEmail: 'support@example.com'
      }
    });

    expect(result.version).toBe('1.1.0');
    expect(result.subject).toContain('Invitacion para unirte a Acme');
    expect(result.html).toContain('lang="es"');
    expect(result.html).toContain('Aceptar invitacion');
    expect(result.html).toContain('Rol asignado');
    expect(result.text).toContain('Rol asignado: Member');
  });

  it('renders the reset-password template with the reset URL and expiration details', () => {
    const result = service.render({
      key: 'reset-password',
      variables: {
        applicationName: 'SaaS Core Engine',
        recipientEmail: 'john@example.com',
        recipientFirstName: 'John',
        resetPasswordUrl: 'https://app.example.com/auth/reset-password?token=abc',
        expiresAt: '2026-03-08T00:00:00.000Z',
        supportEmail: 'support@example.com'
      }
    });

    expect(result.version).toBe('1.0.0');
    expect(result.subject).toContain('Restablece tu clave');
    expect(result.html).toContain('lang="es"');
    expect(result.html).toContain('Restablecer clave');
    expect(result.html).toContain('https://app.example.com/auth/reset-password?token=abc');
    expect(result.text).toContain('Recibimos una solicitud para restablecer la clave');
    expect(result.text).toContain('support@example.com');
  });
});
