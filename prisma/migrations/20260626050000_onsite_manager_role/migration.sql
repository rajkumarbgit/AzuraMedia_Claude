-- Add ONSITE_MANAGER role: tagged to one or more clients, sees the client portal scoped to them.
ALTER TYPE "Role" ADD VALUE 'ONSITE_MANAGER';

-- Join table tagging an ONSITE_MANAGER user to one or more clients.
CREATE TABLE "ManagedClient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedClient_userId_clientId_key" ON "ManagedClient"("userId", "clientId");

ALTER TABLE "ManagedClient" ADD CONSTRAINT "ManagedClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedClient" ADD CONSTRAINT "ManagedClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
