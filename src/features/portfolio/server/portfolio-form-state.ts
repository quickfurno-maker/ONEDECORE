export type PortfolioFormState = {
  success: boolean;
  message: string;
  fieldErrors: Record<string, string[]>;
  redirectTo?: string;
};

export const INITIAL_PORTFOLIO_FORM_STATE: PortfolioFormState = {
  success: false,
  message: "",
  fieldErrors: {},
};
