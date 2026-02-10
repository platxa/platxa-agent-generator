-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'UPLOADING', 'INSTALLING', 'VERIFYING', 'SUCCESS', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "colorPalette" JSONB,
    "settings" JSONB,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "isGenerated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSnapshot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "files" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "deploymentId" TEXT,

    CONSTRAINT "ProjectSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "odooUrl" TEXT NOT NULL,
    "odooDatabase" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "filesDeployed" JSONB NOT NULL,
    "manifestContent" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationLog" TEXT,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rolledBackFromId" TEXT,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "tokensUsed" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "ProjectFile_projectId_idx" ON "ProjectFile"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFile_projectId_path_key" ON "ProjectFile"("projectId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSnapshot_deploymentId_key" ON "ProjectSnapshot"("deploymentId");

-- CreateIndex
CREATE INDEX "ProjectSnapshot_projectId_idx" ON "ProjectSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");

-- CreateIndex
CREATE INDEX "Deployment_userId_idx" ON "Deployment"("userId");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE INDEX "RateLimitEntry_key_idx" ON "RateLimitEntry"("key");

-- CreateIndex
CREATE INDEX "RateLimitEntry_windowStart_idx" ON "RateLimitEntry"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitEntry_key_endpoint_key" ON "RateLimitEntry"("key", "endpoint");

-- CreateIndex
CREATE INDEX "UsageLog_userId_idx" ON "UsageLog"("userId");

-- CreateIndex
CREATE INDEX "UsageLog_endpoint_idx" ON "UsageLog"("endpoint");

-- CreateIndex
CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSnapshot" ADD CONSTRAINT "ProjectSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSnapshot" ADD CONSTRAINT "ProjectSnapshot_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_rolledBackFromId_fkey" FOREIGN KEY ("rolledBackFromId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
