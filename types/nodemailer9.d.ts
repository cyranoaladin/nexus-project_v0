/**
 * Type declarations for the nodemailer9 npm alias (npm:nodemailer@9.0.3).
 *
 * This project uses an npm alias to install nodemailer@9.0.3 as "nodemailer9"
 * to avoid the optional peer dependency conflict with next-auth (which
 * optionally peers on nodemailer@6.x).
 *
 * Compatibility evidence:
 * - nodemailer's createTransport/sendMail/verify/close signatures are stable
 *   across 6.x -> 9.x. The CHANGELOG shows no breaking changes to these APIs.
 * - @types/nodemailer@7.0.9 covers the full public API used in this project:
 *   createTransport, sendMail, verify, close, Transporter, SendMailOptions,
 *   SentMessageInfo, TransportOptions, SMTPTransport.
 * - Runtime verification: __tests__/config/nodemailer-alias.test.ts asserts
 *   that require('nodemailer9').createTransport is a function at runtime.
 *
 * If nodemailer@10+ introduces breaking API changes, these declarations
 * must be reviewed and the runtime test updated.
 */

declare module 'nodemailer9' {
  export * from 'nodemailer';
  import nodemailer from 'nodemailer';
  export default nodemailer;
}

declare module 'nodemailer9/lib/mailer' {
  export * from 'nodemailer/lib/mailer';
  import Mail from 'nodemailer/lib/mailer';
  export default Mail;
}

declare module 'nodemailer9/lib/smtp-transport' {
  export * from 'nodemailer/lib/smtp-transport';
  import SMTPTransport from 'nodemailer/lib/smtp-transport';
  export default SMTPTransport;
}
