import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SESClient } from "@aws-sdk/client-ses";

@Module({
  imports: [ConfigModule],
  providers: [
    MailService,
    {
      provide: SESClient,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const region = configService.get<string>("AWS_REGION");
        const accessKeyId = configService.get<string>("AWS_ACCESS_KEY_ID");
        const secretAccessKey = configService.get<string>(
          "AWS_SECRET_ACCESS_KEY",
        );

        if (!region || !accessKeyId || !secretAccessKey) {
          throw new Error("Missing AWS credentials for SESClient");
        }

        return new SESClient({
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
