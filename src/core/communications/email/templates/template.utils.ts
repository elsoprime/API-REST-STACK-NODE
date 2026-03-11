const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character]);
}

const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
] as const;

export interface CorporateEmailDetailRow {
  label: string;
  value: string;
}

export interface CorporateEmailLayoutOptions {
  applicationName: string;
  previewText: string;
  eyebrow: string;
  title: string;
  greeting?: string | null;
  introParagraphs: string[];
  actionLabel: string;
  actionUrl: string;
  detailRows?: readonly CorporateEmailDetailRow[];
  outroParagraphs: string[];
  supportLine: string;
  disclaimer: string;
}

function renderParagraphs(paragraphs: readonly string[]): string {
  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; line-height: 24px; color: #1f2937;">${escapeHtml(paragraph)}</p>`
    )
    .join('');
}

function renderDetailRows(rows: readonly CorporateEmailDetailRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  const renderedRows = rows
    .map(
      (row) => `
              <tr>
                <td style="padding: 0 0 10px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 18px; color: #475569; font-weight: 700;">
                  ${escapeHtml(row.label)}
                </td>
              </tr>
              <tr>
                <td style="padding: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 22px; color: #0f172a;">
                  ${escapeHtml(row.value)}
                </td>
              </tr>
            `
    )
    .join('');

  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px 0; background-color: #f8fafc; border: 1px solid #dbe3ee;">
              <tr>
                <td style="padding: 24px;">
                  ${renderedRows}
                </td>
              </tr>
            </table>
          `;
}

export function renderCorporateEmailLayout(options: CorporateEmailLayoutOptions): string {
  const greetingBlock = options.greeting
    ? `<p style="margin: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; line-height: 24px; color: #1f2937; font-weight: 700;">${escapeHtml(options.greeting)}</p>`
    : '';

  const actionUrl = escapeHtml(options.actionUrl);

  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${escapeHtml(options.title)}</title>`,
    '</head>',
    '<body style="margin: 0; padding: 0; background-color: #e5e7eb;">',
    `  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">${escapeHtml(options.previewText)}</div>`,
    '  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #e5e7eb;">',
    '    <tr>',
    '      <td align="center" style="padding: 24px 12px;">',
    '        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 640px; background-color: #ffffff; border: 1px solid #cbd5e1;">',
    '          <tr>',
    '            <td style="padding: 28px 32px 24px 32px; background-color: #0f172a;">',
    `              <p style="margin: 0 0 12px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 16px; letter-spacing: 1.2px; text-transform: uppercase; color: #93c5fd;">${escapeHtml(options.eyebrow)}</p>`,
    `              <h1 style="margin: 0 0 10px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 28px; line-height: 34px; color: #f8fafc;">${escapeHtml(options.title)}</h1>`,
    `              <p style="margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 20px; color: #cbd5e1;">${escapeHtml(options.applicationName)}</p>`,
    '            </td>',
    '          </tr>',
    '          <tr>',
    '            <td style="padding: 32px;">',
    `              ${greetingBlock}`,
    `              ${renderParagraphs(options.introParagraphs)}`,
    '              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">',
    '                <tr>',
    '                  <td style="background-color: #1d4ed8;">',
    `                    <a href="${actionUrl}" style="display: inline-block; padding: 14px 24px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 20px; font-weight: 700; color: #ffffff; text-decoration: none;">${escapeHtml(options.actionLabel)}</a>`,
    '                  </td>',
    '                </tr>',
    '              </table>',
    `              ${renderDetailRows(options.detailRows ?? [])}`,
    `              ${renderParagraphs(options.outroParagraphs)}`,
    `              <p style="margin: 0 0 8px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 21px; color: #475569;">Si el boton no funciona, copia y pega este enlace en tu navegador:</p>`,
    `              <p style="margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 20px; color: #1d4ed8; word-break: break-all;"><a href="${actionUrl}" style="color: #1d4ed8; text-decoration: underline;">${actionUrl}</a></p>`,
    '            </td>',
    '          </tr>',
    '          <tr>',
    '            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e5e7eb;">',
    `              <p style="margin: 0 0 10px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 20px; color: #475569;">${escapeHtml(options.supportLine)}</p>`,
    `              <p style="margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 18px; color: #64748b;">${escapeHtml(options.disclaimer)}</p>`,
    '            </td>',
    '          </tr>',
    '        </table>',
    '      </td>',
    '    </tr>',
    '  </table>',
    '</body>',
    '</html>'
  ].join('');
}

export function formatExpiration(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const month = SPANISH_MONTHS[parsed.getUTCMonth()];
  const year = parsed.getUTCFullYear();
  const hours = String(parsed.getUTCHours()).padStart(2, '0');
  const minutes = String(parsed.getUTCMinutes()).padStart(2, '0');

  return `${day} de ${month} de ${year} a las ${hours}:${minutes} UTC`;
}
