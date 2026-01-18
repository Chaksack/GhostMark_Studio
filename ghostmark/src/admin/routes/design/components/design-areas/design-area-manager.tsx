import React, { useState, useEffect } from 'react'
import { Button, Input, Select, Textarea, Card, Badge, Alert } from '@medusajs/ui'

interface DesignArea {
  id: string
  name: string
  product_type_id?: string
  area_type: 'front' | 'back' | 'sleeve_left' | 'sleeve_right' | 'neck' | 'pocket' | 'custom'
  is_active: boolean
  sort_order: number
  position: { x: number; y: number; z?: number }
  dimensions: { width: number; height: number }
  boundaries: { x: number; y: number; w: number; h: number }
  constraints: {
    minWidth: number
    minHeight: number
    maxWidth: number
    maxHeight: number
    margin: number
    allowRotation: boolean
    allowResize: boolean
  }
  print_methods: string[]
  max_colors?: number
  pricing: {
    basePrice: number
    colorPrice: number
    layerPrice: number
    setupFee: number
    currency: string
  }
}

interface DesignAreaGroup {
  id: string
  name: string
  description?: string
  product_type_id?: string
  pricing_strategy: 'single_charge' | 'per_area' | 'tiered'
  group_price?: number
  currency_code: string
  design_area_ids: string[]
  max_designs_per_group: number
  require_all_areas: boolean
  is_active: boolean
}

export const DesignAreaManager: React.FC = () => {
  const [designAreas, setDesignAreas] = useState<DesignArea[]>([])
  const [designAreaGroups, setDesignAreaGroups] = useState<DesignAreaGroup[]>([])
  const [productTypes, setProductTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'areas' | 'groups' | 'pod-products'>('areas')
  
  // POD Products state
  const [podProducts, setPodProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [productDesignAreas, setProductDesignAreas] = useState<any[]>([])
  const [showProductAssignment, setShowProductAssignment] = useState(false)

  // Form states
  const [showAreaForm, setShowAreaForm] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingArea, setEditingArea] = useState<DesignArea | null>(null)
  const [editingGroup, setEditingGroup] = useState<DesignAreaGroup | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [areasRes, groupsRes, productsRes] = await Promise.all([
        fetch('/admin/design-areas'),
        fetch('/admin/design-area-groups'),
        fetch('/admin/products?type=POD&limit=50') // Fetch POD products
      ])

      if (areasRes.ok) {
        const areasData = await areasRes.json()
        setDesignAreas(areasData.design_areas || [])
      }

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json()
        setDesignAreaGroups(groupsData.design_area_groups || [])
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json()
        // Filter for POD products only
        const pods = (productsData.products || []).filter((p: any) => 
          p.type?.value?.toLowerCase() === 'pod' || 
          p.metadata?.isPOD === true
        )
        setPodProducts(pods)
      }
    } catch (err: any) {
      setError('Failed to fetch design areas: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteArea = async (id: string) => {
    if (!confirm('Are you sure you want to delete this design area?')) return

    try {
      const res = await fetch(`/admin/design-areas/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDesignAreas(prev => prev.filter(area => area.id !== id))
      } else {
        throw new Error('Failed to delete design area')
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this design area group?')) return

    try {
      const res = await fetch(`/admin/design-area-groups/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDesignAreaGroups(prev => prev.filter(group => group.id !== id))
      } else {
        throw new Error('Failed to delete design area group')
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  // POD product functions
  const fetchProductDesignAreas = async (productId: string) => {
    try {
      const res = await fetch(`/admin/products/${productId}/design-areas`)
      if (res.ok) {
        const data = await res.json()
        setProductDesignAreas(data.designAreas || [])
        return data
      } else {
        throw new Error('Failed to fetch product design areas')
      }
    } catch (err: any) {
      setError(err.message)
      return null
    }
  }

  const assignDesignAreasToProduct = async (productId: string, designAreaIds: string[]) => {
    try {
      const res = await fetch(`/admin/products/${productId}/design-areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designAreaIds })
      })
      if (res.ok) {
        await fetchProductDesignAreas(productId)
        setError(null)
        return true
      } else {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to assign design areas')
      }
    } catch (err: any) {
      setError(err.message)
      return false
    }
  }

  const handleSelectProduct = async (product: any) => {
    setSelectedProduct(product)
    await fetchProductDesignAreas(product.id)
  }

  if (loading) {
    return <div className="p-6">Loading design areas...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Design Area Management</h1>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'areas' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('areas')}
          >
            Design Areas ({designAreas.length})
          </Button>
          <Button
            variant={activeTab === 'groups' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('groups')}
          >
            Area Groups ({designAreaGroups.length})
          </Button>
          <Button
            variant={activeTab === 'pod-products' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('pod-products')}
          >
            POD Products ({podProducts.length})
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error">
          <span>{error}</span>
          <Button variant="secondary" size="small" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </Alert>
      )}

      {activeTab === 'areas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Design Areas</h2>
            <Button onClick={() => setShowAreaForm(true)}>
              Add Design Area
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designAreas.map((area) => (
              <Card key={area.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{area.name}</h3>
                    <Badge variant={area.is_active ? 'green' : 'grey'}>
                      {area.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setEditingArea(area)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteArea(area.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Type:</span> {area.area_type}
                  </div>
                  <div>
                    <span className="font-medium">Print Methods:</span> {area.print_methods.join(', ')}
                  </div>
                  <div>
                    <span className="font-medium">Base Price:</span> {area.pricing.currency} {area.pricing.basePrice}
                  </div>
                  <div>
                    <span className="font-medium">Max Colors:</span> {area.max_colors || 'Unlimited'}
                  </div>
                  <div>
                    <span className="font-medium">Dimensions:</span> {area.dimensions.width}x{area.dimensions.height}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Design Area Groups</h2>
            <Button onClick={() => setShowGroupForm(true)}>
              Add Area Group
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {designAreaGroups.map((group) => (
              <Card key={group.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{group.name}</h3>
                    <Badge variant={group.is_active ? 'green' : 'grey'}>
                      {group.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setEditingGroup(group)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Strategy:</span> {group.pricing_strategy}
                  </div>
                  {group.group_price && (
                    <div>
                      <span className="font-medium">Group Price:</span> {group.currency_code} {group.group_price / 100}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Areas:</span> {group.design_area_ids.length} areas
                  </div>
                  <div>
                    <span className="font-medium">Max Designs:</span> {group.max_designs_per_group}
                  </div>
                  {group.description && (
                    <div>
                      <span className="font-medium">Description:</span> {group.description}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'pod-products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">POD Products</h2>
            <Button onClick={() => setShowProductAssignment(true)}>
              Assign Design Areas
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {podProducts.map((product) => (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{product.title}</h3>
                    <p className="text-sm text-gray-500">{product.handle}</p>
                    <Badge variant="green">POD</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleSelectProduct(product)}
                    >
                      Manage Areas
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Product Type:</span> {product.type?.value || 'POD'}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {product.status}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {selectedProduct && (
            <Card className="p-6 mt-6">
              <h3 className="text-lg font-medium mb-4">
                Design Areas for "{selectedProduct.title}"
              </h3>
              
              {productDesignAreas.length > 0 ? (
                <div className="space-y-4">
                  {productDesignAreas.map((area) => (
                    <div key={area.id} className="border p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{area.name}</h4>
                          <p className="text-sm text-gray-600">{area.description}</p>
                          <Badge variant={area.assignment?.isActive ? 'green' : 'grey'}>
                            {area.assignment?.isActive ? 'Assigned' : 'Not Assigned'}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          {!area.assignment && (
                            <Button
                              size="small"
                              onClick={() => assignDesignAreasToProduct(selectedProduct.id, [area.id])}
                            >
                              Assign
                            </Button>
                          )}
                          {area.assignment && (
                            <Button
                              variant="danger"
                              size="small"
                              onClick={() => {
                                // Remove assignment logic would go here
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No design areas configured for this product.</p>
              )}
              
              <div className="flex gap-2 justify-end mt-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedProduct(null)}
                >
                  Close
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Quick setup for common configurations */}
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Quick Setup</h3>
        <div className="space-y-4">
          <Button
            variant="secondary"
            onClick={() => {
              // Create default areas for t-shirt
              setError('Quick setup not implemented yet - use the Add buttons above')
            }}
          >
            Create T-Shirt Design Areas
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              // Create default groups
              setError('Quick setup not implemented yet - use the Add buttons above')
            }}
          >
            Create Default Groups (Front+Back, Sleeves)
          </Button>
        </div>
      </Card>

      {/* Form modals would go here - simplified for now */}
      {(showAreaForm || editingArea) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">
              {editingArea ? 'Edit Design Area' : 'Add Design Area'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Form implementation would go here. For now, please use the API directly.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAreaForm(false)
                  setEditingArea(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {(showGroupForm || editingGroup) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">
              {editingGroup ? 'Edit Design Area Group' : 'Add Design Area Group'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Form implementation would go here. For now, please use the API directly.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowGroupForm(false)
                  setEditingGroup(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}