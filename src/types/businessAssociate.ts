export type RepeatedContact = {
  name: string;
  identification?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  company?: string;
  participation?: string;
};

export type BankReference = RepeatedContact & {
  accountNumber?: string;
};

export type BusinessAssociateFormData = {
  associateTypes: string[];
  clientTypes: string[];
  supplierTypes: string[];
  otherAssociateType: string;
  contractorFormality: string;
  company: {
    hasCertifications: string;
    certifications: string[];
    otherCertification: string;
    customerCode: string;
    commercialName: string;
    legalName: string;
    rnc: string;
    economicActivity: string;
    regime: string;
    address: string;
    sector: string;
    city: string;
    country: string;
    postalCode: string;
    phone: string;
    fax: string;
    email: string;
    website: string;
    description: string;
  };
  representative: {
    fullName: string;
    idNumber: string;
    occupation: string;
    maritalStatus: string;
    address: string;
    sector: string;
    city: string;
    phone: string;
    mobile: string;
    email: string;
  };
  operations: {
    merchandiseClasses: string;
    vehicleClasses: string;
  };
  shareholders: RepeatedContact[];
  legalRepresentatives: RepeatedContact[];
  contacts: {
    commercial: RepeatedContact;
    payments: RepeatedContact;
    dispatch: RepeatedContact;
    other: RepeatedContact;
  };
  commercialReferences: RepeatedContact[];
  bankReferences: BankReference[];
  familyReferences: RepeatedContact[];
  guarantor: {
    fullName: string;
    idNumber: string;
    occupation: string;
    maritalStatus: string;
    address: string;
    sector: string;
    city: string;
    phone: string;
    mobile: string;
    email: string;
  };
  emergencyContacts: RepeatedContact[];
  payment: {
    method: string;
    creditDays: string;
    currencies: string[];
  };
  documentsConfirmed: string[];
  authorization: {
    accepted: boolean;
    applicantName: string;
    date: string;
    signatureCaptured: boolean;
  };
};

export type BusinessAssociateApplication = {
  id: string;
  tracking_code: string;
  status: "pending" | "in_review" | "approved" | "rejected";
  associate_type: string[];
  company_name: string;
  tax_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  form_data: BusinessAssociateFormData;
  customer_id: string | null;
  internal_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type BusinessAssociateDocument = {
  id: string;
  application_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  file_size: number;
  created_at: string;
};
