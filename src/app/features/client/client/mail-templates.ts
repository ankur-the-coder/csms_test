export type MailTemplateId = 'classic' | 'modern' | 'minimal' | 'bold';

export interface MailTemplateTheme {
  pageBg: string;
  cardBg: string;
  cardRadius: string;
  cardBorder: string;
  headerBg: string;
  headerImage?: string;
  headerColor: string;      // text color of the brand name
  headerAccent: string;     // color of "Hrm"
  headerAlign: 'center' | 'left';
  headerBorder: string;
  showLogo: boolean;
  logoBg?: string;
  bodyColor: string;
  footerBg: string;
  footerColor: string;
  topBar?: string;          // thin accent bar above the card
}

export interface MailTemplate {
  id: MailTemplateId;
  name: string;
  description: string;
  theme: MailTemplateTheme;
  subject: (companyName: string) => string;
  body: (contactName: string, companyName: string) => string;
}

export const MAIL_TEMPLATES: MailTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean white, teal brand',
    theme: {
      pageBg: '#f1f5f9', cardBg: '#ffffff', cardRadius: '12px', cardBorder: 'none',
      headerBg: '#ffffff', headerColor: '#1e293b', headerAccent: '#14b8a6',
      headerAlign: 'center', headerBorder: '1px solid #f1f5f9', showLogo: true,
      bodyColor: '#334155', footerBg: '#ffffff', footerColor: '#94a3b8',
    },
    subject: (c) => `Welcome to UbiHrm, ${c}!`,
    body: (n, c) =>
      `<p>Hi ${n},</p>` +
      `<p>Welcome aboard! We're excited to have ${c} on UbiHrm. Your account has been set up and the portal is ready whenever you are.</p>` +
      `<p>Best,<br>The UbiHrm Team</p>`,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Gradient header, friendly',
    theme: {
      pageBg: '#eef2ff', cardBg: '#ffffff', cardRadius: '16px', cardBorder: 'none',
      headerBg: '#4f46e5',
      headerImage: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
      headerColor: '#ffffff', headerAccent: '#c7d2fe',
      headerAlign: 'center', headerBorder: 'none', showLogo: true, logoBg: '#ffffff',
      bodyColor: '#334155', footerBg: '#f8fafc', footerColor: '#94a3b8',
    },
    subject: (c) => `🎉 You're all set, ${c}!`,
    body: (n, c) =>
      `<p>Hello ${n} 👋</p>` +
      `<p>We're thrilled to welcome <strong>${c}</strong> to UbiHrm! Your workspace is live and ready to explore.</p>` +
      `<p>Here's what happens next:</p>` +
      `<ul><li>Our team will schedule a kickoff meeting</li><li>We'll help you set up your organization</li><li>You'll get training for your team</li></ul>` +
      `<p>Cheers,<br>The UbiHrm Team</p>`,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Plain, text-first',
    theme: {
      pageBg: '#ffffff', cardBg: '#ffffff', cardRadius: '0', cardBorder: 'none',
      headerBg: '#ffffff', headerColor: '#0f172a', headerAccent: '#14b8a6',
      headerAlign: 'left', headerBorder: 'none', showLogo: false,
      bodyColor: '#1e293b', footerBg: '#ffffff', footerColor: '#94a3b8',
      topBar: '#14b8a6',
    },
    subject: (c) => `Welcome, ${c}`,
    body: (n, c) =>
      `<p>Hi ${n},</p>` +
      `<p>Thanks for choosing UbiHrm. ${c} is now set up, and we're here if you need anything.</p>` +
      `<p>Regards,<br>UbiHrm Team</p>`,
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Dark header, strong accent',
    theme: {
      pageBg: '#e2e8f0', cardBg: '#ffffff', cardRadius: '8px', cardBorder: '1px solid #cbd5e1',
      headerBg: '#0f172a', headerColor: '#ffffff', headerAccent: '#34d399',
      headerAlign: 'left', headerBorder: 'none', showLogo: false,
      bodyColor: '#334155', footerBg: '#0f172a', footerColor: '#94a3b8',
      topBar: '#10b981',
    },
    subject: (c) => `Welcome to the UbiHrm family, ${c}`,
    body: (n, c) =>
      `<p>Dear ${n},</p>` +
      `<p><strong>Welcome to UbiHrm.</strong> ${c} is now part of our platform, and your onboarding starts today.</p>` +
      `<p>Reply to this email anytime and our team will get back to you quickly.</p>` +
      `<p>Best regards,<br>The UbiHrm Team</p>`,
  },
];

export const getMailTemplate = (id: MailTemplateId) =>
  MAIL_TEMPLATES.find((t) => t.id === id) ?? MAIL_TEMPLATES[0];