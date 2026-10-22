export interface ContactRecord {
  id: string;
  organizationId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  nationality?: string | null;
  preferredLanguage: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactsPageData {
  organization: { id: string; name: string };
  role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT";
  contacts: ContactRecord[];
  search: string;
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}
