import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { UserId } from "../../common/decorators/user-id.decorator";
import { ContactService } from "./contact.service";
import { UpdateContactDTO } from "./dto/update-contact.dto";
import { CreateContactDTO } from "./dto/create-contact.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/user.enum";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlanGuard } from "../../common/guards/plan.guard";
import { ContactFilterDTO } from "./dto/contact-filter.dto";
import { CheckPermission } from "../../common/decorators/check-permission.decorator";

@ApiTags("Contacts")
@UseGuards(RolesGuard, PlanGuard)
@Roles(Role.USER)
@Controller("contacts")
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @ApiOperation({ summary: "Create a new contact" })
  @Post()
  @CheckPermission("CONTACT_MAX_COUNT")
  async create(@Body() dto: CreateContactDTO, @UserId() userId: number) {
    return this.service.create(userId, dto);
  }

  @ApiOperation({ summary: "Get one contact" })
  @Get(":id")
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @UserId() user_id: number,
  ) {
    return this.service.findOne(user_id, id);
  }

  @ApiOperation({ summary: "List contacts com filters and pagination" })
  @Get()
  async list(@UserId() userId: number, @Query() filter: ContactFilterDTO) {
    return this.service.listContacts(userId, filter);
  }

  @ApiOperation({ summary: "Update a contact" })
  @Patch(":id")
  async update(@UserId() userId: number, @Body() dto: UpdateContactDTO) {
    console.log("update acionado no controller");
    return this.service.update(userId, dto);
  }

  @ApiOperation({ summary: "Delete a contact" })
  @Delete(":id")
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @UserId() userId: number,
  ) {
    await this.service.remove(userId, id);
  }
}
