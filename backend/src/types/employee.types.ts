export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  pickupPointId?: number | null;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  active?: boolean;
};
