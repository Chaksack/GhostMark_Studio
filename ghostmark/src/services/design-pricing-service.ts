import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

interface DesignArea {
  id: string
  area_type: 'front' | 'back' | 'sleeve_left' | 'sleeve_right' | 'neck' | 'pocket' | 'custom'
  pricing: {
    basePrice: number
    colorPrice: number
    layerPrice: number
    setupFee: number
    currency: string
  }
  [key: string]: any
}

interface DesignAreaGroup {
  id: string
  name: string
  pricing_strategy: 'single_charge' | 'per_area' | 'tiered'
  group_price: number | null
  currency_code: string
  design_area_ids: string[]
  max_designs_per_group: number
  require_all_areas: boolean
}

interface DesignSubmission {
  areaId: string
  areaType: string
  layers: number
  colors: number
  printMethod?: string
  fileUrl?: string
  fileType?: 'default' | 'front' | 'back' | 'left_sleeve' | 'right_sleeve' | 'neck' | 'pocket'
  imageMetadata?: {
    dpi: number
    qualityScore: number
    isPrintReady: boolean
    suggestedUse: string
    width: number
    height: number
    fileSize?: number
    format?: string
  }
}

interface PricingCalculation {
  areaBreakdown: Array<{
    areaId: string
    areaType: string
    groupName?: string
    basePrice: number
    colorPrice: number
    layerPrice: number
    setupFee: number
    subtotal: number
    isGroupCharge: boolean
    groupId?: string
  }>
  groupCharges: Array<{
    groupId: string
    groupName: string
    price: number
    areasIncluded: string[]
    currency: string
  }>
  totals: {
    subtotal: number
    setupFees: number
    total: number
    currency: string
    savings?: number // Amount saved through grouping
  }
}

export class DesignPricingService {
  private query: any

  constructor(container: any) {
    this.query = container.resolve(ContainerRegistrationKeys.QUERY)
  }

  async calculatePricing(
    productTypeId: string,
    designs: DesignSubmission[],
    quantity: number = 1,
    options?: {
      currency?: string
      urgent?: boolean
      shipmentMethod?: string
    },
    productId?: string
  ): Promise<PricingCalculation> {
    
    // If productId provided, try POD metadata-based pricing with special grouping rules
    if (productId) {
      const metaPricing = await this.calculatePodMetadataPricing(productId, designs, quantity, options)
      if (metaPricing) return metaPricing
    }

    // Fallback: Fetch design areas and groups for this product type
    const [designAreas, designAreaGroups] = await Promise.all([
      this.fetchDesignAreas(productTypeId),
      this.fetchDesignAreaGroups(productTypeId)
    ])

    // Create area lookup
    const areaMap = new Map<string, DesignArea>()
    designAreas.forEach(area => areaMap.set(area.id, area))

    // Group areas by pricing groups
    const groupedAreas = this.groupDesignsByPricingGroups(designs, designAreaGroups, areaMap)
    
    // Calculate pricing
    const calculation = this.calculateGroupedPricing(groupedAreas, designAreaGroups, areaMap, quantity)
    
    return calculation
  }

  private async calculatePodMetadataPricing(
    productId: string,
    designs: DesignSubmission[],
    quantity: number,
    options?: { currency?: string }
  ): Promise<PricingCalculation | null> {
    try {
      // Load product metadata for POD pricing
      const [products] = await this.query.graph({
        entity: 'product',
        filters: { id: productId },
        fields: ['id', 'metadata']
      })
      if (!products || products.length === 0) return null

      const product = products[0] as any
      const pod = product?.metadata?.pod || null
      const printAreas = pod?.print_areas || null
      if (!pod || !printAreas) return null

      // Prefer caller-provided currency (e.g., region currency), then product metadata, then USD
      const currency = (options?.currency || pod.currency || 'USD') as string

      // Helper to get per-side price in minor units, supporting per-currency overrides
      const getMinor = (side: string): number => {
        const area = (printAreas as any)[side] || {}
        const byCurrency = area?.print_price_minor_by_currency
        let minor: number | undefined
        if (byCurrency && typeof byCurrency === 'object') {
          const val = byCurrency[currency]
          if (typeof val === 'number') minor = val
        }
        if (minor == null && typeof area?.print_price_minor === 'number') {
          minor = area.print_price_minor
        }
        return Math.max(0, Number(minor || 0))
      }

      // Collect selected area types from designs
      const selectedTypes = designs.map(d => (d.areaType || d.fileType || 'front') as string)

      // Grouping rules:
      // - Front/Back together: charge once at max(front, back) if any selected from the pair
      // - Sleeves together: charge once at max(left_sleeve, right_sleeve) if any selected from the pair
      // - All other area types: charge per selection using their own price
      const frontMinor = getMinor('front')
      const backMinor = getMinor('back')
      const leftMinor = getMinor('left_sleeve')
      const rightMinor = getMinor('right_sleeve')

      const frontBackSelected = selectedTypes.some(t => t === 'front' || t === 'back')
      const sleevesSelected = selectedTypes.some(t => t === 'left_sleeve' || t === 'right_sleeve')

      const otherTypes = selectedTypes.filter(t => !['front', 'back', 'left_sleeve', 'right_sleeve'].includes(t))

      // Compute charges in minor units
      let subtotalMinor = 0
      const areaBreakdown: PricingCalculation['areaBreakdown'] = []

      if (frontBackSelected) {
        const chargeMinor = Math.max(frontMinor, backMinor)
        subtotalMinor += chargeMinor * quantity
        areaBreakdown.push({
          areaId: 'group_front_back',
          areaType: 'front_back',
          groupName: 'Front/Back',
          basePrice: (chargeMinor / 100) * quantity,
          colorPrice: 0,
          layerPrice: 0,
          setupFee: 0,
          subtotal: (chargeMinor / 100) * quantity,
          isGroupCharge: true,
          groupId: 'front_back'
        })
      }

      if (sleevesSelected) {
        const chargeMinor = Math.max(leftMinor, rightMinor)
        subtotalMinor += chargeMinor * quantity
        areaBreakdown.push({
          areaId: 'group_sleeves',
          areaType: 'sleeves',
          groupName: 'Sleeves',
          basePrice: (chargeMinor / 100) * quantity,
          colorPrice: 0,
          layerPrice: 0,
          setupFee: 0,
          subtotal: (chargeMinor / 100) * quantity,
          isGroupCharge: true,
          groupId: 'sleeves'
        })
      }

      // Charge others per selection
      otherTypes.forEach((t, idx) => {
        const minor = getMinor(t)
        const subtotalThis = (minor / 100) * quantity
        subtotalMinor += minor * quantity
        areaBreakdown.push({
          areaId: `${t}_${idx}`,
          areaType: t,
          basePrice: subtotalThis,
          colorPrice: 0,
          layerPrice: 0,
          setupFee: 0,
          subtotal: subtotalThis,
          isGroupCharge: false
        })
      })

      const totals = {
        subtotal: subtotalMinor / 100,
        setupFees: 0,
        total: subtotalMinor / 100,
        currency
      }

      return {
        areaBreakdown,
        groupCharges: [],
        totals
      }
    } catch (e) {
      // On any failure, fall back to default pricing
      return null
    }
  }

  private async fetchDesignAreas(productTypeId: string): Promise<DesignArea[]> {
    try {
      const areas = await this.query.graph({
        entity: "design_area",
        filters: {
          product_type_id: productTypeId,
          is_active: true
        },
        pagination: {
          order: { sort_order: "ASC" }
        }
      }).find()

      return areas || []
    } catch (error) {
      console.error('Error fetching design areas:', error)
      return []
    }
  }

  private async fetchDesignAreaGroups(productTypeId: string): Promise<DesignAreaGroup[]> {
    try {
      const groups = await this.query.graph({
        entity: "design_area_group",
        filters: {
          product_type_id: productTypeId,
          is_active: true
        },
        pagination: {
          order: { sort_order: "ASC" }
        }
      }).find()

      return groups || []
    } catch (error) {
      console.error('Error fetching design area groups:', error)
      return []
    }
  }

  private groupDesignsByPricingGroups(
    designs: DesignSubmission[],
    groups: DesignAreaGroup[],
    areaMap: Map<string, DesignArea>
  ) {
    const result = {
      groupedDesigns: new Map<string, DesignSubmission[]>(), // groupId -> designs
      ungroupedDesigns: [] as DesignSubmission[]
    }

    // Create area type to group mapping
    const areaToGroupMap = new Map<string, string>()
    groups.forEach(group => {
      group.design_area_ids.forEach(areaId => {
        areaToGroupMap.set(areaId, group.id)
      })
    })

    // Sort designs into groups
    designs.forEach(design => {
      const groupId = areaToGroupMap.get(design.areaId)
      if (groupId) {
        if (!result.groupedDesigns.has(groupId)) {
          result.groupedDesigns.set(groupId, [])
        }
        result.groupedDesigns.get(groupId)!.push(design)
      } else {
        result.ungroupedDesigns.push(design)
      }
    })

    return result
  }

  private calculateGroupedPricing(
    groupedAreas: { groupedDesigns: Map<string, DesignSubmission[]>, ungroupedDesigns: DesignSubmission[] },
    groups: DesignAreaGroup[],
    areaMap: Map<string, DesignArea>,
    quantity: number
  ): PricingCalculation {
    
    const areaBreakdown: PricingCalculation['areaBreakdown'] = []
    const groupCharges: PricingCalculation['groupCharges'] = []
    let subtotal = 0
    let setupFees = 0
    let potentialSavings = 0

    // Process grouped designs
    groupedAreas.groupedDesigns.forEach((designs, groupId) => {
      const group = groups.find(g => g.id === groupId)
      if (!group) return

      if (group.pricing_strategy === 'single_charge' && group.group_price) {
        // Single charge for the entire group (e.g., front+back = one charge)
        const groupPrice = group.group_price / 100 // Convert from minor units
        groupCharges.push({
          groupId: group.id,
          groupName: group.name,
          price: groupPrice * quantity,
          areasIncluded: designs.map(d => d.areaId),
          currency: group.currency_code
        })

        // Add individual area breakdown for transparency, but mark as group charge
        designs.forEach(design => {
          const area = areaMap.get(design.areaId)
          if (!area) return

          // Calculate what individual pricing would have been
          const individualPrice = this.calculateIndividualAreaPrice(design, area, quantity)
          potentialSavings += individualPrice.subtotal

          areaBreakdown.push({
            areaId: design.areaId,
            areaType: design.areaType,
            groupName: group.name,
            groupId: group.id,
            basePrice: 0, // No individual charge
            colorPrice: 0,
            layerPrice: 0,
            setupFee: 0,
            subtotal: 0,
            isGroupCharge: true
          })
        })

        subtotal += groupPrice * quantity

      } else if (group.pricing_strategy === 'per_area') {
        // Charge per area but potentially with group discounts
        designs.forEach(design => {
          const area = areaMap.get(design.areaId)
          if (!area) return

          const pricing = this.calculateIndividualAreaPrice(design, area, quantity)
          
          areaBreakdown.push({
            areaId: design.areaId,
            areaType: design.areaType,
            groupName: group.name,
            ...pricing,
            isGroupCharge: false
          })

          subtotal += pricing.subtotal
          setupFees += pricing.setupFee
        })

      } else {
        // Tiered pricing - complex logic based on number of areas used
        const tierMultiplier = this.calculateTierMultiplier(designs.length, group)
        
        designs.forEach(design => {
          const area = areaMap.get(design.areaId)
          if (!area) return

          const pricing = this.calculateIndividualAreaPrice(design, area, quantity, tierMultiplier)
          
          areaBreakdown.push({
            areaId: design.areaId,
            areaType: design.areaType,
            groupName: group.name,
            ...pricing,
            isGroupCharge: false
          })

          subtotal += pricing.subtotal
          setupFees += pricing.setupFee
        })
      }
    })

    // Process ungrouped designs
    groupedAreas.ungroupedDesigns.forEach(design => {
      const area = areaMap.get(design.areaId)
      if (!area) return

      const pricing = this.calculateIndividualAreaPrice(design, area, quantity)
      
      areaBreakdown.push({
        areaId: design.areaId,
        areaType: design.areaType,
        ...pricing,
        isGroupCharge: false
      })

      subtotal += pricing.subtotal
      setupFees += pricing.setupFee
    })

    // Calculate savings
    const actualTotal = subtotal + setupFees
    const savings = potentialSavings > actualTotal ? potentialSavings - actualTotal : 0

    return {
      areaBreakdown,
      groupCharges,
      totals: {
        subtotal,
        setupFees,
        total: actualTotal,
        currency: 'USD', // TODO: Get from product/region
        savings: savings > 0 ? savings : undefined
      }
    }
  }

  private calculateIndividualAreaPrice(
    design: DesignSubmission,
    area: DesignArea,
    quantity: number,
    tierMultiplier: number = 1
  ) {
    const basePrice = (area.pricing.basePrice || 0) * tierMultiplier
    const colorPrice = ((area.pricing.colorPrice || 0) * design.colors) * tierMultiplier
    const layerPrice = ((area.pricing.layerPrice || 0) * Math.max(0, design.layers - 1)) * tierMultiplier
    let setupFee = area.pricing.setupFee || 0

    // Apply quality-based pricing adjustments (inspired by Gelato's approach)
    let qualityMultiplier = 1
    if (design.imageMetadata) {
      const { dpi, qualityScore, isPrintReady, suggestedUse, fileSize, format } = design.imageMetadata

      // DPI-based adjustments
      if (dpi >= 300) {
        qualityMultiplier = 1.0 // No change for high-DPI images
      } else if (dpi < 150) {
        // Lower DPI requires special handling - may need upsampling or reprocessing
        qualityMultiplier = 1.2 // 20% surcharge for low-DPI images
        setupFee = setupFee * 1.3 // Higher setup fee for image processing
      }

      // File size adjustments (larger files may need processing)
      if (fileSize && fileSize > 50 * 1024 * 1024) { // > 50MB
        qualityMultiplier *= 1.1 // 10% surcharge for large files
        setupFee = setupFee * 1.2 // Higher processing fee
      }

      // Format-based adjustments
      if (format === 'SVG') {
        qualityMultiplier *= 0.9 // Discount for vector files
      } else if (format === 'PDF') {
        qualityMultiplier *= 0.95 // Small discount for PDF
      } else if (format && ['WEBP', 'GIF'].includes(format.toUpperCase())) {
        qualityMultiplier *= 1.15 // Surcharge for non-standard formats
        setupFee = setupFee * 1.3
      }

      // Quality score adjustments
      if (qualityScore < 40) {
        // Very poor quality - additional processing needed
        qualityMultiplier *= 1.25
        setupFee = setupFee * 1.4
      } else if (qualityScore >= 80 && isPrintReady) {
        // High quality images get a small discount
        qualityMultiplier *= 0.95
      }

      // Suggested use adjustments
      switch (suggestedUse) {
        case 'commercial-print':
          qualityMultiplier *= 0.9 // Discount for commercial-ready images
          break
        case 'web-only':
          qualityMultiplier *= 1.3 // Surcharge for web-only quality
          setupFee = setupFee * 1.5 // Higher processing fee
          break
        case 'small-print':
          qualityMultiplier *= 1.1 // Small surcharge
          break
      }
    }

    // Apply quality multiplier to base pricing
    const adjustedBasePrice = basePrice * qualityMultiplier
    const adjustedColorPrice = colorPrice * qualityMultiplier
    const adjustedLayerPrice = layerPrice * qualityMultiplier

    const itemTotal = adjustedBasePrice + adjustedColorPrice + adjustedLayerPrice
    const subtotal = itemTotal * quantity

    return {
      basePrice: adjustedBasePrice * quantity,
      colorPrice: adjustedColorPrice * quantity,
      layerPrice: adjustedLayerPrice * quantity,
      setupFee: Math.round(setupFee * 100) / 100, // Round to cents
      subtotal: subtotal + setupFee,
      qualityAdjustment: qualityMultiplier !== 1 ? {
        multiplier: qualityMultiplier,
        reason: this.getQualityAdjustmentReason(design.imageMetadata)
      } : undefined
    }
  }

  private getQualityAdjustmentReason(metadata?: DesignSubmission['imageMetadata']): string {
    if (!metadata) return 'No image metadata'
    
    const { dpi, qualityScore, suggestedUse } = metadata
    
    if (dpi < 150) return 'Low DPI - additional processing required'
    if (qualityScore < 40) return 'Poor image quality - enhancement needed'
    if (suggestedUse === 'web-only') return 'Web-only quality - print optimization required'
    if (suggestedUse === 'commercial-print' && qualityScore >= 80) return 'Commercial-ready - quality discount applied'
    
    return 'Quality-based adjustment'
  }

  private calculateTierMultiplier(designCount: number, group: DesignAreaGroup): number {
    // Simple tiered pricing logic
    // More areas used = better pricing per area
    if (designCount >= 4) return 0.7 // 30% discount
    if (designCount >= 2) return 0.85 // 15% discount
    return 1.0 // No discount
  }

  // Predefined groups for common combinations
  async createDefaultGroups(productTypeId: string): Promise<void> {
    const defaultGroups = [
      {
        name: 'Front & Back',
        description: 'Front and back design areas charged as one',
        product_type_id: productTypeId,
        pricing_strategy: 'single_charge' as const,
        group_price: 500, // $5.00 in minor units
        currency_code: 'USD',
        design_area_ids: [], // Will be populated based on area types
        max_designs_per_group: 1,
        require_all_areas: false,
        is_active: true,
        sort_order: 0
      },
      {
        name: 'Sleeves & Neck',
        description: 'Sleeve and neck areas charged as one',
        product_type_id: productTypeId,
        pricing_strategy: 'single_charge' as const,
        group_price: 300, // $3.00 in minor units
        currency_code: 'USD',
        design_area_ids: [], // Will be populated based on area types
        max_designs_per_group: 1,
        require_all_areas: false,
        is_active: true,
        sort_order: 1
      }
    ]

    // Create the groups
    for (const groupData of defaultGroups) {
      try {
        await this.query.graph({
          entity: "design_area_group",
          data: groupData
        }).create()
      } catch (error) {
        console.error('Error creating default group:', groupData.name, error)
      }
    }
  }
}