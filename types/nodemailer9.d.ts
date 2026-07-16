/**
 * Type declarations for the nodemailer9 npm alias (npm:nodemailer@9.0.3).
 *
 * nodemailer9 is an npm alias that resolves to nodemailer@9.0.3.
 * @types/nodemailer@7.x covers the public API surface used here.
 *
 * Compatibility: nodemailer 7.x -> 9.x did not change the createTransport/sendMail
 * signatures. The @types/nodemailer@7.0.9 types remain accurate for these APIs.
 * See: https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md
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
