import { Prisma } from "@prisma/client";

// Auto-generates a job number in the uniform "<CLIENT_CODE>-0001" format, atomically
// incrementing the client's running sequence so numbers are always unique (per-client
// sequence + globally-unique client code = globally-unique job number).
export async function generateJobNo(tx: Prisma.TransactionClient, clientId: string): Promise<{ jobNo: string; clientCode: string }> {
  const client = await tx.client.update({
    where: { id: clientId },
    data: { jobSeq: { increment: 1 } },
  });
  const jobNo = `${client.code}-${String(client.jobSeq).padStart(4, "0")}`;
  return { jobNo, clientCode: client.code };
}
