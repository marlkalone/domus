import { registerAs } from "@nestjs/config";

export default registerAs("mail", () => ({
  fromEmail: process.env.DEFAULT_EMAIL_FROM || "nao-responda@domus.com",
  fromName: process.env.MAIL_FROM_NAME || "Equipe Domus",
}));
