import { Injectable, InternalServerErrorException } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>("AWS_REGION");
    const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>(
      "AWS_SECRET_ACCESS_KEY",
    );
    const bucket = this.configService.get<string>("AWS_S3_BUCKET_NAME");

    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
      throw new InternalServerErrorException(
        "AWS configuration is incomplete. Check environment variables.",
      );
    }

    this.region = region;
    this.bucket = bucket;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }

  /**
   * Build the public URL
   */
  buildPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}`;
  }

  /**
   * Generate a presigned PUT URL for direct upload.
   */
  async getUploadUrl(
    key: string,
    expiresIn = 900, // 15 minutes
    contentType?: string,
  ): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3Client, cmd, { expiresIn });
  }

  async getFileUrlFromS3(key: string, expiresIn = 3600): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client, cmd, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    const cmd = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(cmd);
  }
}
