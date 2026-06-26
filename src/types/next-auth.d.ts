import { Role, ShiftCode } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      designation: string | null;
      clientId: string | null;
      defaultShift: ShiftCode;
    };
  }
  interface User {
    id: string;
    role: Role;
    designation: string | null;
    clientId?: string | null;
    defaultShift?: ShiftCode;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    designation: string | null;
    clientId: string | null;
    defaultShift: ShiftCode;
  }
}
