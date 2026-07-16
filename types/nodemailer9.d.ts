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
