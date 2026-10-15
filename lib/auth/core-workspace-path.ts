/** Edge navigation only; Core API authorization is independent. */
export function isCoreWorkspacePath(pathname: string): boolean {
  return pathname === '/dashboard/core' || pathname.startsWith('/dashboard/core/');
}
