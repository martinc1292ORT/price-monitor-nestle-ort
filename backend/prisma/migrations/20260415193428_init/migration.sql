-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "targetPrice" DECIMAL(10,2) NOT NULL,
    "tolerance" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'active',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerUrl" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "retailerName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "internalCode" TEXT,
    "country" TEXT,
    "detectedName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "learnedSelector" TEXT,
    "selectorConfidence" DOUBLE PRECISION,
    "lastSelectorUpdate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCapture" (
    "id" SERIAL NOT NULL,
    "retailerUrlId" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPrice" DECIMAL(10,2),
    "struckPrice" DECIMAL(10,2),
    "promoText" TEXT,
    "promoType" TEXT,
    "discountPct" DECIMAL(5,2),
    "stock" TEXT,
    "detectedName" TEXT,
    "screenshotPath" TEXT,
    "htmlPath" TEXT,
    "checkResult" TEXT NOT NULL DEFAULT 'ok',
    "rawData" JSONB,

    CONSTRAINT "PriceCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringRule" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "ruleType" TEXT NOT NULL,
    "minPrice" DECIMAL(10,2),
    "maxPrice" DECIMAL(10,2),
    "allowPromos" BOOLEAN NOT NULL DEFAULT false,
    "maxDiscountPct" DECIMAL(5,2),
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "retailerUrlId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedValue" DECIMAL(10,2),
    "expectedValue" DECIMAL(10,2),
    "description" TEXT,
    "comment" TEXT,
    "resolutionComment" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "assignedUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringConfig" (
    "id" SERIAL NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT '6h',
    "isRunning" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" SERIAL NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retailerUrlId" INTEGER,
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerUrl" ADD CONSTRAINT "RetailerUrl_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceCapture" ADD CONSTRAINT "PriceCapture_retailerUrlId_fkey" FOREIGN KEY ("retailerUrlId") REFERENCES "RetailerUrl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringRule" ADD CONSTRAINT "MonitoringRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_retailerUrlId_fkey" FOREIGN KEY ("retailerUrlId") REFERENCES "RetailerUrl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
