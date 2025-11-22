import { Injectable } from "@nestjs/common";
import { SqsMessageHandler, SqsConsumerEventHandler } from "@ssut/nestjs-sqs";
import * as AWS from "@aws-sdk/client-sqs";
import { StorageService } from "../storage/storage.service";

export const STORAGE_CONSUMER_NAME = "storage-consumer";

@Injectable()
export class StorageConsumer {
  constructor(private readonly storageService: StorageService) {}

  @SqsMessageHandler(STORAGE_CONSUMER_NAME, false)
  async handleMessage(message: AWS.Message) {
    try {
      if (!message.Body) {
        console.warn(
          `[StorageConsumer] Message ${message.MessageId} has no body.`,
        );
        return;
      }

      const body = JSON.parse(message.Body);
      const key = body.key;

      if (!key) {
        console.warn(
          `[StorageConsumer] Message ${message.MessageId} body does not contain a 'key'.`,
        );
        return;
      }

      console.log(`[StorageConsumer] Deleting file from S3: ${key}`);
      await this.storageService.deleteFile(key);
      console.log(`[StorageConsumer] Successfully deleted file: ${key}`);
    } catch (error) {
      console.error(
        `[StorageConsumer] Error processing message ${message.MessageId} for key ${message.Body}:`,
        error,
      );
      throw error;
    }
  }

  @SqsConsumerEventHandler(STORAGE_CONSUMER_NAME, "processing_error")
  onProcessingError(error: Error, message: AWS.Message) {
    console.error(
      `[StorageConsumer] SQS onProcessingError for message ${message.MessageId}:`,
      error,
    );
  }
}
