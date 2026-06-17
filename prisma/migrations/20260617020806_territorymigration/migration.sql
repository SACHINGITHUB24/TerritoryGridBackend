/*
  Warnings:

  - You are about to drop the column `blockId` on the `Block` table. All the data in the column will be lost.
  - You are about to drop the column `userblockId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `blockId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_userblockId_fkey";

-- AlterTable
ALTER TABLE "Block" DROP COLUMN "blockId",
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "ownerId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "userblockId",
ADD COLUMN     "blockId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
