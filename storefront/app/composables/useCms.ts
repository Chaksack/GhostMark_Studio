type CmsListResponse<T> = { data?: T[] }

export const useCms = () => {
  const fetchCms = async <T>(path: string, query?: Record<string, any>) => {
    return await $fetch<T>(`/api/cms/${path.replace(/^\//, '')}`, { query })
  }

  const listPosts = async () => {
    try {
      return await fetchCms<CmsListResponse<any>>('posts', {
        sort: ['publishedAt:desc'],
        pagination: { page: 1, pageSize: 12 },
      })
    } catch {
      return { data: [] }
    }
  }

  const getPostBySlug = async (slug: string) => {
    try {
      return await fetchCms<CmsListResponse<any>>('posts', {
        filters: { slug: { $eq: slug } },
        pagination: { page: 1, pageSize: 1 },
      })
    } catch {
      return { data: [] }
    }
  }

  return { fetchCms, listPosts, getPostBySlug }
}
