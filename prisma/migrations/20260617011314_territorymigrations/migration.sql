-- CreateTable
CREATE TABLE "Block" (
    "id" SERIAL NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "name" TEXT NOT NULL,
    "id" SERIAL NOT NULL,
    "userblockId" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_userblockId_fkey" FOREIGN KEY ("userblockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
