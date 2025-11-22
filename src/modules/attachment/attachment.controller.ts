import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  Delete,
  Res,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { AttachmentService } from "./attachment.service";
import { Response } from "express";
import { PresignAttachmentDTO } from "./dto/attachment.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/user.enum";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlanGuard } from "../../common/guards/plan.guard";
import { CheckPermission } from "../../common/decorators/check-permission.decorator";
import { ApiOperation } from "@nestjs/swagger";

@UseGuards(RolesGuard, PlanGuard)
@Roles(Role.USER)
@Controller("attachments")
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post("presign")
  @CheckPermission("ATTACH_TOTAL_COUNT")
  @ApiOperation({ summary: "Get a presigned url for upload files" })
  async presign(@Body() dto: PresignAttachmentDTO) {
    return this.attachmentService.presignUrls(dto);
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Get a file url download" })
  async download(
    @Param("id") id: number,
    @Query("expiresIn") expiresIn: string,
    @Res() res: Response,
  ) {
    const expiry = expiresIn ? parseInt(expiresIn, 10) : undefined;
    const url = await this.attachmentService.getDownloadUrl(id, expiry);
    return res.redirect(HttpStatus.FOUND, url);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a attach" })
  async remove(@Param("id") id: number) {
    await this.attachmentService.remove(id);
    return { message: `Attachment #${id} deleted` };
  }
}
