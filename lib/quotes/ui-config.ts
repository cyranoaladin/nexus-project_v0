/**
 * UX-tunable bounds for the public devis wizard (CDC §51: don't scatter the
 * budget slider's example numbers as ad-hoc constants — one place to change
 * them). The hard validation ceiling (`inputMaxTnd`) is shared with
 * `budgetSchema` in http-schemas.ts so the free-typed input can never exceed
 * what the API will actually accept.
 */
export const BUDGET_SLIDER_TND = {
  sliderMinTnd: 300,
  sliderMaxTnd: 3000,
  sliderStepTnd: 50,
  inputMinTnd: 0,
  inputMaxTnd: 20000,
} as const;
