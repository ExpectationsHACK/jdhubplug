import { NotFoundContent } from "@/components/home/NotFound";

// Fallback 404 for URLs outside the storefront and admin route groups.
export default function NotFound() {
  return <NotFoundContent withLogo />;
}
