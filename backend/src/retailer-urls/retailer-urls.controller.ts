import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { RetailerUrlsService } from './retailer-urls.service';
import { CreateRetailerUrlDto } from './dto/create-retailer-url.dto';
import { UpdateRetailerUrlDto } from './dto/update-retailer-url.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('retailer-urls')
export class RetailerUrlsController {
  constructor(private retailerUrlsService: RetailerUrlsService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateRetailerUrlDto) {
    return this.retailerUrlsService.create(dto);
  }

  @Get()
  findAll(
    @Query() query: PaginationDto,
    @Query('productId') productId?: string,
  ) {
    const pid = productId ? parseInt(productId, 10) : undefined;
    if (pid !== undefined && isNaN(pid)) {
      throw new BadRequestException('productId must be a number');
    }
    return this.retailerUrlsService.findAll(query.page, query.limit, pid);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.retailerUrlsService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRetailerUrlDto,
  ) {
    return this.retailerUrlsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.retailerUrlsService.remove(id);
  }
}
