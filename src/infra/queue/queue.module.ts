import { Module } from "@nestjs/common";
import { ConfigService, ConfigModule } from "@nestjs/config";
import { SqsModule } from "@ssut/nestjs-sqs";
import { MailModule } from "../mail/mail.module";
import {
  EMAIL_PRODUCER_NAME,
  QueueProducerService,
  STORAGE_PRODUCER_NAME,
} from "./queue.producer.service";
import { EMAIL_CONSUMER_NAME, EmailConsumer } from "./email.consumer";
import { StorageModule } from "../storage/storage.module";
import { STORAGE_CONSUMER_NAME, StorageConsumer } from "./storage.consumer";

@Module({
  imports: [
    ConfigModule,
    MailModule,
    StorageModule,
    SqsModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const region = configService.get<string>("AWS_REGION");
        const accessKeyId = configService.get<string>("AWS_ACCESS_KEY_ID");
        const secretAccessKey = configService.get<string>(
          "AWS_SECRET_ACCESS_KEY",
        );
        const emailQueueName = configService.get<string>(
          "AWS_SQS_EMAIL_QUEUE_NAME",
        );
        const emailQueueUrl = configService.get<string>(
          "AWS_SQS_EMAIL_QUEUE_URL",
        );
        const storageQueueName = configService.get<string>(
          "AWS_SQS_STORAGE_QUEUE_NAME",
        );
        const storageQueueUrl = configService.get<string>(
          "AWS_SQS_STORAGE_QUEUE_URL",
        );

        if (
          !region ||
          !accessKeyId ||
          !secretAccessKey ||
          !emailQueueName ||
          !emailQueueUrl ||
          !storageQueueName ||
          !storageQueueUrl
        ) {
          throw new Error("Missing SQS AWS configuration in .env");
        }

        const awsSdkOptions = {
          region: region,
          credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
          },
        };

        return {
          consumers: [
            {
              name: EMAIL_CONSUMER_NAME,
              queueUrl: emailQueueUrl,
              awsSdkOptions: awsSdkOptions,
              messageAttributeNames: ["All"],
            },
            {
              name: STORAGE_CONSUMER_NAME,
              queueUrl: storageQueueUrl,
              awsSdkOptions: awsSdkOptions,
              messageAttributeNames: ["All"],
            },
          ],
          producers: [
            {
              name: EMAIL_PRODUCER_NAME,
              queueUrl: emailQueueUrl,
              awsSdkOptions: awsSdkOptions,
            },
            {
              name: STORAGE_PRODUCER_NAME,
              queueUrl: storageQueueUrl,
              awsSdkOptions: awsSdkOptions,
            },
          ],
        };
      },
    }),
  ],
  providers: [EmailConsumer, QueueProducerService, StorageConsumer],
  exports: [QueueProducerService],
})
export class QueueModule {}
