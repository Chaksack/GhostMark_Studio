import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useState, useEffect } from "react"
import { Button, toast } from "@medusajs/ui"
import { Plus, PencilSquare, Trash, Eye, Upload } from "@medusajs/icons"

// Design Area Configuration Interface
interface DesignAreaConfig {
  id: string
  name: string
  description?: string
  position: { x: number; y: number; z?: number }
  dimensions: { width: number; height: number }
  boundaries: { x: number; y: number; w: number; h: number }
  type: string
  printMethods: string[]
  techniques: string[]
  maxColors?: number
  layerSupport: {
    maxLayers: number
    supportedTypes: string[]
    blendModes: string[]
  }
  constraints: {
    minWidth: number
    minHeight: number
    maxWidth: number
    maxHeight: number
    aspectRatio?: number
    margin: number
    allowRotation: boolean
    allowResize: boolean
    snapToGrid?: boolean
    gridSize?: number
  }
  pricing: {
    basePrice: number
    colorPrice: number
    layerPrice: number
    setupFee: number
    currency: string
    priceBreaks?: Array<{
      quantity: number
      discount: number
    }>
  }
  mockup: {
    templateUrl?: string
    overlayUrl?: string
    backgroundUrl?: string
    previewScale: number
  }
  validation: {
    minDPI: number
    recommendedDPI: number
    maxFileSize: string
    supportedFormats: string[]
    colorModes: string[]
  }
  isActive: boolean
  sortOrder: number
  metadata?: Record<string, any>
}

// Product Type Design Areas Widget
const ProductTypeDesignAreasWidget = ({ data }: { data?: { id: string } }) => {
  const [designAreas, setDesignAreas] = useState<DesignAreaConfig[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingArea, setEditingArea] = useState<DesignAreaConfig | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const productTypeId = data?.id

  // Fetch design areas
  const fetchDesignAreas = async () => {
    if (!productTypeId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/admin/product-types/${productTypeId}/design-areas`)
      if (response.ok) {
        const result = await response.json()
        setDesignAreas(result.designAreas || [])
      }
    } catch (error) {
      console.error('Failed to fetch design areas:', error)
      toast.error('Failed to load design areas')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDesignAreas()
  }, [productTypeId])

  // Create new design area
  const createDesignArea = async (areaData: Partial<DesignAreaConfig>) => {
    if (!productTypeId) return

    try {
      const response = await fetch(`/admin/product-types/${productTypeId}/design-areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(areaData)
      })

      if (response.ok) {
        toast.success('Design area created successfully')
        await fetchDesignAreas()
        setShowCreateModal(false)
      } else {
        toast.error('Failed to create design area')
      }
    } catch (error) {
      console.error('Error creating design area:', error)
      toast.error('Failed to create design area')
    }
  }

  // Update design area
  const updateDesignArea = async (areaId: string, updates: Partial<DesignAreaConfig>) => {
    if (!productTypeId) return

    try {
      const response = await fetch(`/admin/product-types/${productTypeId}/design-areas/${areaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        toast.success('Design area updated successfully')
        await fetchDesignAreas()
        setEditingArea(null)
      } else {
        toast.error('Failed to update design area')
      }
    } catch (error) {
      console.error('Error updating design area:', error)
      toast.error('Failed to update design area')
    }
  }

  // Delete design area
  const deleteDesignArea = async (areaId: string) => {
    if (!productTypeId || !confirm('Are you sure you want to delete this design area?')) return

    try {
      const response = await fetch(`/admin/product-types/${productTypeId}/design-areas/${areaId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Design area deleted successfully')
        await fetchDesignAreas()
      } else {
        toast.error('Failed to delete design area')
      }
    } catch (error) {
      console.error('Error deleting design area:', error)
      toast.error('Failed to delete design area')
    }
  }

  // Upload mockup image
  const uploadMockup = async (file: File, type: 'template' | 'overlay' | 'background') => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          setIsUploading(true)
          const response = await fetch('/admin/uploads/mockup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataUrl: reader.result as string,
              filename: file.name,
              type,
              productTypeId
            })
          })

          if (response.ok) {
            const result = await response.json()
            resolve(result.url)
          } else {
            reject(new Error('Upload failed'))
          }
        } catch (error) {
          reject(error)
        } finally {
          setIsUploading(false)
        }
      }
      reader.onerror = () => reject(new Error('File read error'))
      reader.readAsDataURL(file)
    })
  }

  if (!productTypeId) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Design Areas</h3>
        <p className="text-gray-500">Product type ID not available</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Design Areas</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure print areas, pricing, and constraints for POD products
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Design Area
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : designAreas.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
            <Plus className="h-6 w-6 text-gray-600" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No design areas</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first design area.
          </p>
          <div className="mt-6">
            <Button onClick={() => setShowCreateModal(true)}>
              Add Design Area
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {designAreas.map((area) => (
            <div
              key={area.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{area.name}</h4>
                  <p className="text-sm text-gray-500 capitalize">{area.type}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingArea(area)}
                  >
                    <PencilSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteDesignArea(area.id)}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Size:</span>
                  <span>{area.dimensions.width}×{area.dimensions.height}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Base Price:</span>
                  <span className="font-medium text-green-600">
                    ${area.pricing.basePrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Methods:</span>
                  <span className="capitalize">{area.printMethods.join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Layers:</span>
                  <span>{area.layerSupport.maxLayers}</span>
                </div>
              </div>

              {area.mockup.templateUrl && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Eye className="w-4 h-4" />
                    <span>Has mockup template</span>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  area.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {area.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal would go here */}
      {(showCreateModal || editingArea) && (
        <DesignAreaModal
          area={editingArea}
          isOpen={showCreateModal || !!editingArea}
          onClose={() => {
            setShowCreateModal(false)
            setEditingArea(null)
          }}
          onSave={(areaData) => {
            if (editingArea) {
              updateDesignArea(editingArea.id, areaData)
            } else {
              createDesignArea(areaData)
            }
          }}
          onUploadMockup={uploadMockup}
          isUploading={isUploading}
        />
      )}
    </div>
  )
}

// Design Area Modal Component
const DesignAreaModal = ({ 
  area, 
  isOpen, 
  onClose, 
  onSave, 
  onUploadMockup, 
  isUploading 
}: {
  area?: DesignAreaConfig | null
  isOpen: boolean
  onClose: () => void
  onSave: (areaData: Partial<DesignAreaConfig>) => void
  onUploadMockup: (file: File, type: 'template' | 'overlay' | 'background') => Promise<string>
  isUploading: boolean
}) => {
  const [formData, setFormData] = useState<Partial<DesignAreaConfig>>({
    name: '',
    type: 'front',
    position: { x: 100, y: 100 },
    dimensions: { width: 200, height: 200 },
    pricing: { basePrice: 2.0, colorPrice: 0.5, layerPrice: 1.0, setupFee: 0.0, currency: 'USD' },
    printMethods: ['dtg'],
    techniques: ['dtg'],
    isActive: true,
    ...area
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {area ? 'Edit Design Area' : 'Create Design Area'}
            </h3>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault()
            onSave(formData)
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g., Front Design Area"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                value={formData.type || 'front'}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
                <option value="sleeve">Sleeve</option>
                <option value="pocket">Pocket</option>
                <option value="embroidery_chest_left">Embroidery Chest Left</option>
                <option value="embroidery_chest_right">Embroidery Chest Right</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Width (px)</label>
                <input
                  type="number"
                  value={formData.dimensions?.width || 200}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions!, width: parseInt(e.target.value) }
                  }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Height (px)</label>
                <input
                  type="number"
                  value={formData.dimensions?.height || 200}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions!, height: parseInt(e.target.value) }
                  }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Base Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.pricing?.basePrice || 2.0}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    pricing: { ...prev.pricing!, basePrice: parseFloat(e.target.value) }
                  }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Color Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.pricing?.colorPrice || 0.5}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    pricing: { ...prev.pricing!, colorPrice: parseFloat(e.target.value) }
                  }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive !== false}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">Active</label>
            </div>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {area ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Widget configuration
export const config = defineWidgetConfig({
  zone: "product_type.details.after",
})

export default ProductTypeDesignAreasWidget