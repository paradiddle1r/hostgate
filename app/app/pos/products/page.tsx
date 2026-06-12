import { getActiveProperty } from "@/lib/active-property-server";
import { listProducts, listCategories } from "@/lib/db/pos";
import ProductsClient from "@/components/app/pos/ProductsClient";
import PosTabs from "@/components/app/pos/PosTabs";

export const dynamic = "force-dynamic";

export default async function PosProductsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const [productsRes, catsRes] = await Promise.all([
    listProducts(property.id),
    listCategories(property.id),
  ]);

  return (
    <>
      <PosTabs />
      <ProductsClient
        products={productsRes.ok ? productsRes.data : []}
        categories={catsRes.ok ? catsRes.data : []}
        currency={property.currency}
      />
    </>
  );
}
