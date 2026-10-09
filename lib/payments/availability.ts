/** Bank transfers are closed until explicitly qualified for this deployment.
 * Kept separate from the unimplemented ClicToPay gateway's public flag.
 */
export function isBankTransferEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER === 'true';
}
