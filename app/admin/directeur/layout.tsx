import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DirecteurAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
