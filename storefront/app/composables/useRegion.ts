export const useRegion = () => {
  const regionId = useCookie<string | null>('gms_region_id', { sameSite: 'lax' })
  const region = useState<Record<string, unknown> | null>('gms_region', () => null)

  const sdk = useMedusaClient()

  const ensureRegion = async () => {
    if (region.value && regionId.value) return { region: region.value, regionId: regionId.value }
    try {
      const res = await sdk.store.region.list({ limit: 50 } as any)
      const first = ((res as any)?.regions?.[0] as { id?: string } | undefined) || undefined
      if (!first?.id) return { region: null, regionId: null }
      regionId.value = first.id
      region.value = first as unknown as Record<string, unknown>
      return { region: region.value, regionId: first.id }
    } catch {
      return { region: null, regionId: null }
    }
  }

  return { regionId, region, ensureRegion }
}
