import type { CompanyDetails } from "./validation";

export interface CompanyChoice {
  id: string;
  name: string;
  slug: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT";
}
export interface CompanyWorkspace {
  companies: CompanyChoice[];
  activeCompany: CompanyChoice | null;
  hasPendingInvitations: boolean;
}
export interface PendingCompanyInvitation {
  id: string;
  role: string;
  expiresAt: string;
  organization: { name: string };
}
export interface CompanyRecord {
  id: string;
  name: string;
  slug: string;
  emirate: CompanyDetails["emirate"] | null;
  contactPhone: string | null;
  companyEmail: string | null;
  companySize: CompanyDetails["companySize"] | null;
}
