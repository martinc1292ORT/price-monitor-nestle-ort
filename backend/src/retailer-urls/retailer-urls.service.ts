import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRetailerUrlDto } from './dto/create-retailer-url.dto';
import { UpdateRetailerUrlDto } from './dto/update-retailer-url.dto';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class RetailerUrlsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRetailerUrlDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product)
      throw new NotFoundException(`Product #${dto.productId} not found`);

    return this.prisma.retailerUrl.create({ data: dto });
  }

  async findAll(
    page: number,
    limit: number,
    productId?: number,
  ): Promise<PaginatedResponse<unknown>> {
    const skip = (page - 1) * limit;
    const where = productId ? { productId } : {};

    const [data, total] = await Promise.all([
      this.prisma.retailerUrl.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
      this.prisma.retailerUrl.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: number) {
    const retailerUrl = await this.prisma.retailerUrl.findUnique({
      where: { id },
      include: { product: { select: { id: true, name: true, sku: true } } },
    });
    if (!retailerUrl)
      throw new NotFoundException(`RetailerUrl #${id} not found`);
    return retailerUrl;
  }

  async update(id: number, dto: UpdateRetailerUrlDto) {
    await this.findOne(id);
    return this.prisma.retailerUrl.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.retailerUrl.delete({ where: { id } });
  }
}
