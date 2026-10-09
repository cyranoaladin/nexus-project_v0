/** Exact shared account page; authentication and resource guards still apply. */
export function isAccountSecurityPath(pathname: string): boolean {
  return pathname === '/dashboard/account/security' || pathname === '/dashboard/account/security/';
}
