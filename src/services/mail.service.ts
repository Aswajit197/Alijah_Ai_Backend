import nodemailer, { type Transporter } from 'nodemailer';

export interface SendInvitationParams {
  to: string;
  recipientName: string;
  tenantName: string;
  roleName: string;
  inviteLink: string;
  expiresInHours?: number;
}

export interface SendJobAssignmentParams {
  to: string;
  technicianName: string;
  tenantName: string;
  jobNumber: string;
  title: string;
  customerName: string;
  customerPhone: string;
  serviceAddress: string;
  gateCode?: string | null;
  scheduledWindow: string;
  priority?: string;
  portalUrl?: string;
}

export class MailService {
  private static transporter: Transporter | null = null;

  private static getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      return this.transporter;
    }

    return null;
  }

  /**
   * Dispatches an invitation email to set password.
   * If SMTP is not configured, logs the preview to the console for frictionless local development.
   */
  static async sendInvitation(params: SendInvitationParams): Promise<{ success: boolean; simulated: boolean }> {
    const { to, recipientName, tenantName, roleName, inviteLink, expiresInHours = 24 } = params;
    const transporter = this.getTransporter();

    const subject = `Welcome to Elijah AI — Activate your account for ${tenantName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #080C15; color: #F8FAFC; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #0E1526; border: 1px solid #1E2C4A; border-radius: 20px; padding: 36px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">ELIJAH <span style="color: #4F46E5;">AI</span></span>
          </div>

          <h1 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin-bottom: 12px;">
            Welcome to ${tenantName}, ${recipientName}!
          </h1>

          <p style="font-size: 14px; line-height: 1.6; color: #94A3B8; margin-bottom: 24px;">
            You have been invited to join <strong>${tenantName}</strong> as a <strong>${roleName}</strong> on the Elijah AI Autonomous Operations Platform.
          </p>

          <div style="background-color: #151F36; border: 1px solid #1E2C4A; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
            <p style="margin: 0; font-size: 13px; color: #CBD5E1;">
              Click the button below to set up your password and access your operations workspace.
            </p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #F59E0B; font-weight: 600;">
              ⚠️ This single-use link will expire in ${expiresInHours} hours.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${inviteLink}" style="display: inline-block; background-color: #4F46E5; color: #FFFFFF; padding: 14px 28px; border-radius: 12px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
              Set Up Your Password →
            </a>
          </div>

          <p style="font-size: 12px; color: #64748B; margin-bottom: 8px;">
            If the button doesn't work, copy and paste this link in your browser:
          </p>
          <p style="font-size: 11px; color: #06B6D4; word-break: break-all; background-color: #080C15; padding: 10px; border-radius: 8px; border: 1px solid #1E2C4A;">
            ${inviteLink}
          </p>

          <hr style="border: none; border-top: 1px solid #1E2C4A; margin: 28px 0;" />

          <p style="font-size: 11px; color: #64748B; margin: 0; text-align: center;">
            Elijah AI · Autonomous Operations for Trade Contractors
          </p>
        </div>
      </div>
    `;

    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Elijah AI Platform" <noreply@elijah.ai>',
          to,
          subject,
          html,
        });
        console.log(`[MAIL SERVICE] Real email sent via SMTP to: ${to}`);
        return { success: true, simulated: false };
      } catch (err: any) {
        console.warn(`[MAIL SERVICE] SMTP failed (${err.message}), falling back to console log preview.`);
      }
    }

    // Console logging fallback for development
    console.log('\n' + '='.repeat(68));
    console.log('📧 [MAIL SERVICE - INVITATION LINK READY]');
    console.log(`Recipient:   ${recipientName} <${to}>`);
    console.log(`Company:     ${tenantName}`);
    console.log(`Role:        ${roleName}`);
    console.log(`Expires In:  ${expiresInHours} Hours`);
    console.log(`Invite URL:  ${inviteLink}`);
    console.log('='.repeat(68) + '\n');

    return { success: true, simulated: true };
  }

  /**
   * Dispatches a notification email to a field technician when a job is assigned or dispatched.
   */
  static async sendJobAssignment(params: SendJobAssignmentParams): Promise<{ success: boolean; simulated: boolean }> {
    const {
      to,
      technicianName,
      tenantName,
      jobNumber,
      title,
      customerName,
      customerPhone,
      serviceAddress,
      gateCode,
      scheduledWindow,
      priority = 'NORMAL',
      portalUrl = `${process.env.COMPANY_APP_URL || 'http://localhost:3000'}/tech`,
    } = params;
    const transporter = this.getTransporter();

    const isEmergency = priority === 'EMERGENCY';
    const subject = isEmergency
      ? `🚨 URGENT EMERGENCY DISPATCH: ${jobNumber} — ${tenantName}`
      : `📋 New Work Order Assigned: ${jobNumber} — ${tenantName}`;

    const badgeColor = isEmergency ? '#EF4444' : '#4F46E5';
    const badgeBg = isEmergency ? 'rgba(239, 68, 68, 0.15)' : 'rgba(79, 70, 229, 0.15)';
    const badgeBorder = isEmergency ? 'rgba(239, 68, 68, 0.3)' : 'rgba(79, 70, 229, 0.3)';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #080C15; color: #F8FAFC; padding: 40px 20px;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #0E1526; border: 1px solid #1E2C4A; border-radius: 20px; padding: 36px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">ELIJAH <span style="color: #4F46E5;">AI</span></span>
            <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${badgeColor}; background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 4px 10px; border-radius: 9999px;">
              ${isEmergency ? '🚨 Emergency Dispatch' : 'New Job Assignment'}
            </span>
          </div>

          <h1 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin-bottom: 8px;">
            Hello ${technicianName},
          </h1>

          <p style="font-size: 14px; line-height: 1.6; color: #94A3B8; margin-bottom: 24px;">
            You have been assigned to work order <strong>${jobNumber}</strong> for <strong>${tenantName}</strong>. Please review the details below and confirm in the Mobile Field App.
          </p>

          <!-- Job Details Box -->
          <div style="background-color: #151F36; border: 1px solid #1E2C4A; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
            <div style="border-bottom: 1px solid #1E2C4A; padding-bottom: 12px; margin-bottom: 14px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 700;">Issue / Task</span>
              <p style="font-size: 16px; font-weight: 700; color: #FFFFFF; margin: 4px 0 0 0;">${title}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748B; width: 35%;">Arrival Window:</td>
                <td style="padding: 6px 0; color: #38BDF8; font-weight: 600;">${scheduledWindow}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Customer:</td>
                <td style="padding: 6px 0; color: #FFFFFF; font-weight: 600;">${customerName} · <a href="tel:${customerPhone}" style="color: #38BDF8; text-decoration: none;">${customerPhone}</a></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Location:</td>
                <td style="padding: 6px 0; color: #F1F5F9;">${serviceAddress}</td>
              </tr>
              ${
                gateCode
                  ? `<tr>
                      <td style="padding: 6px 0; color: #64748B;">Gate / Access:</td>
                      <td style="padding: 6px 0; color: #F59E0B; font-family: monospace; font-weight: 700;">${gateCode}</td>
                    </tr>`
                  : ''
              }
            </table>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${portalUrl}" style="display: inline-block; background-color: #10B981; color: #FFFFFF; padding: 14px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
              Open Mobile Field App & Confirm →
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #1E2C4A; margin: 24px 0;" />

          <p style="font-size: 11px; color: #64748B; margin: 0; text-align: center;">
            Elijah AI · Autonomous Field Operations for Trade Contractors
          </p>
        </div>
      </div>
    `;

    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Elijah AI Dispatch" <dispatch@elijah.ai>',
          to,
          subject,
          html,
        });
        console.log(`[MAIL SERVICE] Technician dispatch email sent via SMTP to: ${to} for job ${jobNumber}`);
        return { success: true, simulated: false };
      } catch (err: any) {
        console.warn(`[MAIL SERVICE] SMTP failed (${err.message}), falling back to console log preview.`);
      }
    }

    // Console logging fallback for development
    console.log('\n' + '='.repeat(68));
    console.log('📧 [MAIL SERVICE - TECHNICIAN DISPATCH NOTIFICATION]');
    console.log(`To:          ${technicianName} <${to}>`);
    console.log(`Company:     ${tenantName}`);
    console.log(`Work Order:  ${jobNumber} (${priority})`);
    console.log(`Issue:       ${title}`);
    console.log(`Window:      ${scheduledWindow}`);
    console.log(`Customer:    ${customerName} (${customerPhone})`);
    console.log(`Location:    ${serviceAddress}`);
    if (gateCode) console.log(`Gate Code:   ${gateCode}`);
    console.log(`Mobile App:  ${portalUrl}`);
    console.log('='.repeat(68) + '\n');

    return { success: true, simulated: true };
  }
}
