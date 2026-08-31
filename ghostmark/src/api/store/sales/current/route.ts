import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// Get current active sales and discounted products
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingModuleService = req.scope.resolve(Modules.PRICING)
    const productModuleService = req.scope.resolve(Modules.PRODUCT)

    const { 
      product_id,
      variant_id,
      category_id,
      product_type,
      limit = 50 
    } = req.query

    const now = new Date()

    const productId = product_id ? String(Array.isArray(product_id) ? product_id[0] : product_id) : undefined
    const variantId = variant_id ? String(Array.isArray(variant_id) ? variant_id[0] : variant_id) : undefined
    const categoryId = category_id ? String(Array.isArray(category_id) ? category_id[0] : category_id) : undefined
    const productTypeId = product_type ? String(Array.isArray(product_type) ? product_type[0] : product_type) : undefined

    // Get active sale price lists
    const salePriceLists = await pricingModuleService.listPriceLists({
      status: ["active"] as any
    } as any, {
      relations: ["prices"]
    })

    // A price list with NO prices is not a sale, whatever its status says.
    //
    // This is defensive and it is here on purpose. The admin route that used to
    // create these (api/admin/price-lists/sale, deleted 2026-08-30) wrote a real
    // `status: "active"`, `type: "sale"` price list and then returned entirely
    // fabricated response data, a hardcoded "demo_variant" with an invented
    // original_amount, WITHOUT ever attaching prices to it. The result was an
    // empty active sale list that this route would happily advertise on the
    // storefront as a live sale with zero discounted products.
    //
    // Deleting the writer removed the known source. This filter closes the hole
    // independently of how such a list ever comes to exist, by another route, a
    // partial admin action, or a failed import. An empty sale can no longer be
    // advertised regardless of who created it.
    //
    // BUT THIS FILTER ALONE WAS NEVER THE WHOLE FIX, AND IT READS AS IF IT WERE.
    // It closes the fabricated-EMPTY-list case and nothing else. A list holding
    // prices that all point at deleted variants passes this check comfortably,
    // `newyear` has 19 of them. Counting prices is not counting REACHABLE
    // prices. The reachability pass further down is the half that closes that,
    // and it was added later; this note is here so nobody reads the original
    // filter as having always been complete.
    const salePriceListsOnly = (salePriceLists as any[])
      .filter((pl: any) => pl?.type === "sale")
      .filter((pl: any) => Array.isArray(pl?.prices) && pl.prices.length > 0)

    // Filter by date range
    const dateActiveSalePriceLists = salePriceListsOnly.filter((priceList: any) => {
      const startDate = priceList.starts_at ? new Date(priceList.starts_at) : null
      const endDate = priceList.ends_at ? new Date(priceList.ends_at) : null

      if (startDate && startDate > now) return false
      if (endDate && endDate < now) return false

      return true
    })

    // -------------------------------------------------------------------------
    // REACHABILITY. A price only counts if a customer could actually buy it.
    //
    // The `prices.length > 0` filter above is a PROXY. It agrees with the real
    // question in every case we had tested and diverges exactly where it
    // matters: the live `newyear` list carries 19 prices and ZERO reachable
    // ones, because every price_set it points at belongs to a variant that has
    // since been hard-deleted. Counting prices is not counting REACHABLE prices,
    // and a list that passes the count check can still advertise a sale with
    // nothing purchasable behind it.
    //
    // "Exists" is deliberately two separate conditions, because they are two
    // different failure modes and a single check would silently conflate them:
    //   * the variant row is GONE (hard-deleted)   -> the JOIN drops it
    //   * the variant row is SOFT-deleted          -> deleted_at IS NULL drops it
    // The link row itself can also be soft-deleted independently of either.
    //
    // One query keyed on the collected price_set_ids. This runs on the
    // storefront, so a per-price round trip would not be acceptable; the cost
    // here is a single indexed lookup regardless of how many prices are in play.
    // -------------------------------------------------------------------------
    const knex: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

    const candidatePriceSetIds = Array.from(
      new Set(
        dateActiveSalePriceLists.flatMap((pl: any) =>
          (pl.prices ?? []).map((pr: any) => pr?.price_set_id).filter(Boolean),
        ),
      ),
    ) as string[]

    let reachablePriceSetIds = new Set<string>()
    if (candidatePriceSetIds.length > 0) {
      const { rows } = await knex.raw(
        `SELECT DISTINCT pvps.price_set_id
           FROM product_variant_price_set pvps
           JOIN product_variant v ON v.id = pvps.variant_id
          WHERE pvps.price_set_id = ANY(?)
            AND pvps.deleted_at IS NULL
            AND v.deleted_at IS NULL`,
        [candidatePriceSetIds],
      )
      reachablePriceSetIds = new Set(rows.map((r: any) => r.price_set_id))
    }

    // Drop unreachable PRICES from each list, then drop any list left with none.
    //
    // Both, deliberately. A partially-dead sale should advertise its live half,
    // that half is genuinely purchasable and suppressing it would under-report a
    // real discount. Advertising the dead half is what must not happen. Dropping
    // only whole lists would do the wrong thing in both directions: it would
    // either hide live prices or show dead ones.
    const activeSalePriceLists = dateActiveSalePriceLists
      .map((pl: any) => ({
        ...pl,
        prices: (pl.prices ?? []).filter((pr: any) =>
          reachablePriceSetIds.has(pr?.price_set_id),
        ),
      }))
      .filter((pl: any) => pl.prices.length > 0)

    if (activeSalePriceLists.length === 0) {
      return res.json({
        success: true,
        message: "No active sales found",
        current_sales: [],
        discounted_products: [],
        count: 0
      })
    }

    // Collect all sale prices
    const allSalePrices: any[] = []
    activeSalePriceLists.forEach((priceList: any) => {
      if (priceList.prices) {
        priceList.prices.forEach((price: any) => {
          allSalePrices.push({
            ...price,
            price_list_id: priceList.id,
            price_list_title: priceList.title,
            price_list_description: priceList.description,
            sale_ends_at: priceList.ends_at
          })
        })
      }
    })

    // If specific product/variant requested, filter prices
    if (productId || variantId) {
      let filteredPrices = allSalePrices

      if (variantId) {
        // Get the variant's price set ID
        const variants = (await productModuleService.listProductVariants({ id: [variantId] } as any)) as any[]
        if (variants.length > 0) {
          const priceSetId = (variants[0] as any).price_set_id
          filteredPrices = allSalePrices.filter(price => price.price_set_id === priceSetId)
        }
      } else if (productId) {
        // Get all variants for the product
        const products = await productModuleService.listProducts({ id: [productId] } as any, {
          relations: ["variants"]
        })
        
        if (products.length > 0 && products[0].variants) {
          const priceSetIds = products[0].variants.map((v: any) => v.price_set_id).filter(Boolean)
          filteredPrices = allSalePrices.filter(price => priceSetIds.includes(price.price_set_id))
        }
      }

      return res.json({
        success: true,
        sale_prices: filteredPrices,
        count: filteredPrices.length
      })
    }

    // Get products with sale pricing
    const productFilters: any = {}
    if (categoryId) productFilters.category_id = [categoryId]
    if (productTypeId) productFilters.type_id = productTypeId

    const products = await productModuleService.listProducts(productFilters, {
      relations: ["variants", "variants.calculated_price"],
      take: Number(limit)
    } as any)

    // Match products with sale prices
    const discountedProducts: Array<{
      product_id: string
      product_title: string
      product_handle: string
      total_discounted_variants: number
      best_discount_percentage: number
      max_savings: number
      sale_ends_at: string | null
      variant_discounts: Array<{
        variant_id: string
        variant_title: string
        original_price: number
        sale_price: number
        savings: number
        discount_percentage: number
        currency_code: string
        price_list_title: string
        sale_ends_at: string | null
      }>
    }> = []
    
    for (const product of products) {
      if (!product.variants) continue

      const productDiscounts: Array<{
        variant_id: string
        variant_title: string
        original_price: number
        sale_price: number
        savings: number
        discount_percentage: number
        currency_code: string
        price_list_title: string
        sale_ends_at: string | null
      }> = []
      
      for (const variant of product.variants) {
        const priceSetId = (variant as any).price_set_id
        if (!priceSetId) continue

        // Check if this variant has sale pricing
        const salePrices = allSalePrices.filter(price => price.price_set_id === priceSetId)
        
        if (salePrices.length > 0) {
          const bestSalePrice = salePrices.reduce((best, current) => 
            current.amount < best.amount ? current : best
          )

          // Get original price
          const calculated = (variant as any).calculated_price
          const originalPrice = calculated?.original_amount || calculated?.calculated_amount

          if (originalPrice && originalPrice > bestSalePrice.amount) {
            const savings = originalPrice - bestSalePrice.amount
            const discountPercentage = Math.round((savings / originalPrice) * 100)

            productDiscounts.push({
              variant_id: variant.id,
              variant_title: variant.title,
              original_price: originalPrice,
              sale_price: bestSalePrice.amount,
              savings,
              discount_percentage: discountPercentage,
              currency_code: bestSalePrice.currency_code,
              price_list_title: bestSalePrice.price_list_title,
              sale_ends_at: bestSalePrice.sale_ends_at
            })
          }
        }
      }

      if (productDiscounts.length > 0) {
        // Get best discount for product-level stats
        const bestDiscount = productDiscounts.reduce((best, current) => 
          current.discount_percentage > best.discount_percentage ? current : best
        )

        discountedProducts.push({
          product_id: product.id,
          product_title: product.title,
          product_handle: (product as any).handle,
          total_discounted_variants: productDiscounts.length,
          best_discount_percentage: bestDiscount.discount_percentage,
          max_savings: Math.max(...productDiscounts.map(d => d.savings)),
          sale_ends_at: bestDiscount.sale_ends_at,
          variant_discounts: productDiscounts
        })
      }
    }

    // Sort by best discount
    discountedProducts.sort((a, b) => b.best_discount_percentage - a.best_discount_percentage)

    return res.json({
      success: true,
      current_sales: activeSalePriceLists.map((priceList: any) => ({
        id: priceList.id,
        title: priceList.title,
        description: priceList.description,
        starts_at: priceList.starts_at,
        ends_at: priceList.ends_at,
        total_discounted_items: priceList.prices?.length || 0
      })),
      discounted_products: discountedProducts,
      count: discountedProducts.length,
      summary: {
        total_active_sales: activeSalePriceLists.length,
        total_discounted_products: discountedProducts.length,
        best_discount: discountedProducts.length > 0 ? discountedProducts[0].best_discount_percentage : 0,
        total_variants_on_sale: discountedProducts.reduce((sum, p) => sum + p.total_discounted_variants, 0)
      }
    })

  } catch (error: any) {
    console.error('Error fetching current sales:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch current sales"
    })
  }
}