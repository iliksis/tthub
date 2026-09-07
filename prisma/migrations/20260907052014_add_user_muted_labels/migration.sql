-- CreateTable
CREATE TABLE "UserMutedLabel" (
    "userId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "labelId"),
    CONSTRAINT "UserMutedLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserMutedLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
