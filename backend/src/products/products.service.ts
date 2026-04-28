import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (existing)
      throw new ConflictException(`SKU '${dto.sku}' already exists`);

    const product = await this.prisma.product.create({
      data: {
        ...dto,
        tolerance: dto.tolerance ?? null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      },
    });

    await this.prisma.monitoringRule.create({
      data: {
        productId: product.id,
        ruleType: 'no_promo',
        allowPromos: false,
        severity: 'warning',
        isActive: true,
      },
    });

    return product;
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<unknown>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { retailerUrls: true, rules: true } } },
      }),
      this.prisma.product.count(),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { retailerUrls: true, rules: true },
    });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { sku: dto.sku, NOT: { id } },
      });
      if (existing)
        throw new ConflictException(`SKU '${dto.sku}' already exists`);
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }
}
