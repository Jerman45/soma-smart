import { supabase } from './supabase'
import type { Database } from './database.types'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']
type SubjectRow = Database['public']['Tables']['subjects']['Row']
type ResourceRow = Database['public']['Tables']['resources']['Row']
type ReportRow = Database['public']['Tables']['reports']['Row']
type ContactMessageRow = Database['public']['Tables']['contact_messages']['Row']

export type Category = CategoryRow & { resource_count: number }
export type Subject = Pick<SubjectRow, 'id' | 'name' | 'academic_level' | 'is_active'>
export type Resource = ResourceRow & {
  categories: Pick<CategoryRow, 'name'> | null
  subjects: Pick<SubjectRow, 'name'> | null
}
export type ResourceFilters = {
  q?: string
  category?: string
  subject?: string
  level?: string
  classLevel?: string
  year?: string
  sort?: string
  page?: number
  limit?: number
  includeUnpublished?: boolean
}
export type AdminDashboardStats = {
  total_resources: number
  published_resources: number
  draft_resources: number
  total_downloads: number
  textbook_resources: number
  past_papers: number
  study_notes: number
}
export type ResourceReport = ReportRow & { resources: Pick<ResourceRow, 'title'> | null }
export type ContactMessage = ContactMessageRow
export type AdminProfile = Pick<ProfileRow, 'id' | 'full_name' | 'role' | 'created_at'>

function client() {
  if (!supabase) throw new Error('The library is not connected yet. Configure Supabase to continue.')
  return supabase
}

function failRequest(message: string, cause: unknown): never {
  console.error('SOMA SMART data request failed', cause)
  throw new Error(message)
}

export async function getCategories(includeInactive = false): Promise<Category[]> {
  let query = client().from('categories').select('id,name,description,icon,is_active,created_at,resources(count)').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) failRequest('Categories could not be loaded. Please try again.', error)
  return data.map(({ resources, ...category }) => ({
    ...category,
    resource_count: resources.reduce((total, resource) => total + (resource.count ?? 0), 0),
  }))
}

export async function getSubjects(includeInactive = false): Promise<Subject[]> {
  let query = client().from('subjects').select('id,name,academic_level,is_active').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) failRequest('Subjects could not be loaded. Please try again.', error)
  return data
}

export async function getResources(filters: ResourceFilters = {}): Promise<{ items: Resource[]; count: number }> {
  const pageSize = filters.limit ?? 12
  const page = filters.page ?? 0
  let query = client().from('resources').select('*,categories!inner(name),subjects(name)', { count: 'exact' })
  if (!filters.includeUnpublished) query = query.eq('status', 'published')
  if (filters.q) {
    const { data: matches, error: searchError } = await client().rpc('search_resource_ids', {
      search_query: filters.q.trim().slice(0, 120),
    })
    if (searchError) failRequest('Resource search is unavailable. Please try again.', searchError)
    const resourceIds = matches.map(({ resource_id }) => resource_id)
    if (resourceIds.length === 0) return { items: [], count: 0 }
    query = query.in('id', resourceIds)
  }
  if (filters.category) {
    query = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.category)
      ? query.eq('category_id', filters.category)
      : query.eq('categories.name', filters.category)
  }
  if (filters.subject) query = query.eq('subject_id', filters.subject)
  if (filters.level) query = query.eq('academic_level', filters.level)
  if (filters.classLevel) query = query.eq('class_level', filters.classLevel)
  if (filters.year) query = query.eq('academic_year', Number(filters.year))
  if (filters.sort === 'popular') query = query.order('download_count', { ascending: false })
  else if (filters.sort === 'alphabetical') query = query.order('title', { ascending: true })
  else query = query.order('created_at', { ascending: false })
  const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1)
  if (error) failRequest('Resources could not be loaded. Please try again.', error)
  return { items: data as Resource[], count: count ?? 0 }
}

export async function getResource(id: string): Promise<Resource | null> {
  const { data, error } = await client().from('resources').select('*,categories!inner(name),subjects(name)').eq('id', id).eq('status', 'published').maybeSingle()
  if (error) failRequest('This resource could not be opened. Please try again.', error)
  return data as Resource | null
}

export async function getSignedFileUrl(path: string): Promise<string> {
  const { data, error } = await client().storage.from('documents').createSignedUrl(path, 3600)
  if (error) failRequest('This document could not be opened. Please try again later.', error)
  return data.signedUrl
}

export async function getSignedCoverUrl(path: string): Promise<string> {
  const { data, error } = await client().storage.from('covers').createSignedUrl(path, 3600)
  if (error) failRequest('This cover image could not be opened. Please try again later.', error)
  return data.signedUrl
}

export async function recordDownload(resourceId: string): Promise<void> {
  const { error } = await client().rpc('record_download', { resource_uuid: resourceId })
  if (error) failRequest('This download could not be recorded. Please try again.', error)
}

export async function downloadResourceFile(resource: Pick<Resource, 'id' | 'file_path' | 'title'>): Promise<boolean> {
  const signedUrl = await getSignedFileUrl(resource.file_path)
  const response = await fetch(signedUrl)
  if (!response.ok) throw new Error('The document could not be downloaded. Please try again.')
  const file = await response.blob()
  let trackingSucceeded = true
  try {
    await recordDownload(resource.id)
  } catch (cause) {
    trackingSucceeded = false
    console.error('SOMA SMART download tracking failed', cause)
  }
  const objectUrl = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `${resource.title}.${resource.file_path.split('.').pop() ?? 'file'}`
  anchor.rel = 'noopener noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  return trackingSucceeded
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { data, error } = await client().rpc('admin_dashboard_stats_v2')
  if (error) failRequest('Dashboard statistics could not be loaded. Please try again.', error)
  if (!data[0]) throw new Error('Dashboard statistics are unavailable. Sign in again.')
  return data[0]
}

export async function getAdminProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await client().from('profiles').select('id,full_name,role,created_at').order('created_at', { ascending: true })
  if (error) failRequest('Administrator accounts could not be loaded. Please try again.', error)
  return data
}

export async function setProfileRole(id: string, role: 'student' | 'admin'): Promise<void> {
  const { error } = await client().rpc('set_profile_role', { profile_uuid: id, new_role: role })
  if (error) failRequest('The account role could not be changed. Please try again.', error)
}

export async function setAdminProfileName(name: string): Promise<void> {
  const { error } = await client().rpc('set_admin_profile_name', { new_full_name: name.trim() })
  if (error) failRequest('Your profile name could not be updated. Please try again.', error)
}

export async function getReports(): Promise<ResourceReport[]> {
  const { data, error } = await client().from('reports').select('*,resources(title)').order('created_at', { ascending: false }).limit(100)
  if (error) failRequest('Resource reports could not be loaded. Please try again.', error)
  return data as ResourceReport[]
}

export async function createReport(resourceId: string, reason: string, description: string): Promise<void> {
  const { error } = await client().rpc('submit_resource_report', {
    resource_uuid: resourceId,
    report_reason: reason.trim(),
    report_description: description.trim() || null,
  })
  if (error) failRequest('Your report could not be submitted. Please try again.', error)
}

export async function setReportStatus(id: string, status: ReportRow['status']): Promise<void> {
  const { error } = await client().from('reports').update({ status }).eq('id', id)
  if (error) failRequest('The report status could not be changed. Please try again.', error)
}

export async function submitContactMessage(input: {
  fullName: string
  email: string
  subject: string
  message: string
}): Promise<void> {
  const { error } = await client().rpc('submit_contact_message', {
    sender_name: input.fullName.trim(),
    sender_email: input.email.trim(),
    message_subject: input.subject.trim(),
    message_body: input.message.trim(),
  })
  if (error) failRequest('Your message could not be submitted. Please check the form and try again later.', error)
}

export async function getContactMessages(): Promise<ContactMessage[]> {
  const { data, error } = await client().from('contact_messages').select('*').order('created_at', { ascending: false }).limit(100)
  if (error) failRequest('Contact messages could not be loaded. Please try again.', error)
  return data
}

export async function setContactMessageStatus(id: string, status: ContactMessage['status']): Promise<void> {
  const { error } = await client().rpc('set_contact_message_status', { message_uuid: id, new_status: status })
  if (error) failRequest('The contact message status could not be changed. Please try again.', error)
}

async function uploadDocument(database: ReturnType<typeof client>, file: File, resourceId: string) {
  if (file.size <= 0 || file.size > 50 * 1024 * 1024) throw new Error('Choose a document no larger than 50 MB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['pdf', 'docx', 'pptx'].includes(extension)) throw new Error('Only PDF, DOCX and PPTX documents are supported.')
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const isPdf = extension === 'pdf' && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  const isOfficeDocument = ['docx', 'pptx'].includes(extension) && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
  if (!isPdf && !isOfficeDocument) throw new Error('The document contents do not match a valid PDF, DOCX or PPTX file.')
  const path = `${resourceId}/${crypto.randomUUID()}.${extension}`
  const contentType = extension === 'pdf'
    ? 'application/pdf'
    : extension === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  const { error } = await database.storage.from('documents').upload(path, file, { contentType, upsert: false })
  if (error) failRequest('Document upload failed. Check the file and try again.', error)
  return { path, extension }
}

async function uploadCover(database: ReturnType<typeof client>, file: File | null | undefined, resourceId: string) {
  if (!file) return null
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('Choose a cover image no larger than 5 MB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const imageTypes = [
    { extension: 'jpg', matches: () => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff, contentType: 'image/jpeg' },
    { extension: 'jpeg', matches: () => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff, contentType: 'image/jpeg' },
    { extension: 'png', matches: () => header[0] === 0x89 && String.fromCharCode(...header.slice(1, 4)) === 'PNG', contentType: 'image/png' },
    { extension: 'webp', matches: () => String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP', contentType: 'image/webp' },
  ]
  const imageType = imageTypes.find((type) => type.extension === extension && type.matches())
  if (!imageType) throw new Error('The image contents do not match a valid JPG, PNG or WEBP file.')
  const path = `${resourceId}/${crypto.randomUUID()}.${imageType.extension}`
  const { error } = await database.storage.from('covers').upload(path, file, { contentType: imageType.contentType, upsert: false })
  if (error) failRequest('Cover image upload failed. Check the image and try again.', error)
  return path
}

export async function addResource(input: {
  title: string; description: string; categoryId: string; subjectId: string; academicLevel: string
  classLevel: string; academicYear: number | null; author: string; publisher: string; keywords: string[]
  file: File; coverImage?: File | null; published: boolean
}): Promise<{ title: string }> {
  const database = client()
  const { data: { user }, error: userError } = await database.auth.getUser()
  if (userError) failRequest('Your administrator session could not be verified. Sign in again.', userError)
  if (!user) throw new Error('Your administrator session has expired. Sign in again.')
  const resourceId = crypto.randomUUID()
  const { path: filePath, extension } = await uploadDocument(database, input.file, resourceId)
  let coverPath: string | null
  try {
    coverPath = await uploadCover(database, input.coverImage, resourceId)
  } catch (cause) {
    const { error: cleanupError } = await database.storage.from('documents').remove([filePath])
    if (cleanupError) {
      console.error('SOMA SMART document cleanup after cover failure failed', cleanupError)
      throw new Error('The cover image failed to upload and the document could not be removed. Contact an administrator.')
    }
    throw cause
  }
  const { error: insertError } = await database.from('resources').insert({
    id: resourceId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    keywords: input.keywords,
    category_id: input.categoryId,
    subject_id: input.subjectId || null,
    academic_level: input.academicLevel,
    class_level: input.classLevel,
    academic_year: input.academicYear,
    author: input.author.trim() || null,
    publisher: input.publisher.trim() || null,
    cover_image_path: coverPath,
    file_path: filePath,
    file_format: extension,
    file_size: input.file.size,
    status: input.published ? 'published' : 'draft',
    uploaded_by: user.id,
  })
  if (insertError) {
    const { error: documentCleanupError } = await database.storage.from('documents').remove([filePath])
    const { error: coverCleanupError } = coverPath
      ? await database.storage.from('covers').remove([coverPath])
      : { error: null }
    console.error('SOMA SMART resource creation failed', insertError)
    if (documentCleanupError || coverCleanupError) {
      console.error('SOMA SMART uploaded file cleanup failed', documentCleanupError ?? coverCleanupError)
      throw new Error('The resource could not be saved and its uploaded file could not be removed. Contact an administrator.')
    }
    throw new Error('The resource could not be saved. Check the form and try again.')
  }
  return { title: input.title.trim() }
}

export async function updateResource(resource: Resource, input: {
  title: string; description: string; categoryId: string; subjectId: string; academicLevel: string
  classLevel: string; academicYear: number | null; author: string; publisher: string; keywords: string[]
  published: boolean; file?: File; coverImage?: File | null; removeCover?: boolean
}): Promise<void> {
  const database = client()
  const replacement = input.file ? await uploadDocument(database, input.file, resource.id) : null
  let replacementCover: string | null = null
  try {
    replacementCover = await uploadCover(database, input.coverImage, resource.id)
  } catch (cause) {
    if (replacement) {
      const { error: cleanupError } = await database.storage.from('documents').remove([replacement.path])
      if (cleanupError) {
        console.error('SOMA SMART replacement document cleanup failed', cleanupError)
        throw new Error('The cover image failed to upload and the replacement document could not be removed. Contact an administrator.')
      }
    }
    throw cause
  }
  const { error } = await database.from('resources').update({
    title: input.title.trim(),
    description: input.description.trim() || null,
    keywords: input.keywords,
    category_id: input.categoryId,
    subject_id: input.subjectId || null,
    academic_level: input.academicLevel,
    class_level: input.classLevel,
    academic_year: input.academicYear,
    author: input.author.trim() || null,
    publisher: input.publisher.trim() || null,
    status: input.published ? 'published' : 'draft',
    ...(replacement ? { file_path: replacement.path, file_format: replacement.extension, file_size: input.file?.size ?? resource.file_size } : {}),
    ...(replacementCover ? { cover_image_path: replacementCover } : input.removeCover ? { cover_image_path: null } : {}),
  }).eq('id', resource.id)
  if (error) {
    let cleanupFailed = false
    if (replacement) {
      const { error: cleanupError } = await database.storage.from('documents').remove([replacement.path])
      if (cleanupError) { cleanupFailed = true; console.error('SOMA SMART replacement file cleanup failed', cleanupError) }
    }
    if (replacementCover) {
      const { error: cleanupError } = await database.storage.from('covers').remove([replacementCover])
      if (cleanupError) { cleanupFailed = true; console.error('SOMA SMART replacement cover cleanup failed', cleanupError) }
    }
    if (cleanupFailed) failRequest('The resource could not be updated and a replacement file could not be removed. Contact an administrator.', error)
    failRequest('The resource could not be updated. Check the form and try again.', error)
  }
  if (replacement) {
    const { error: cleanupError } = await database.storage.from('documents').remove([resource.file_path])
    if (cleanupError) {
      console.error('SOMA SMART old file cleanup failed', cleanupError)
      throw new Error('The resource was updated, but its previous file could not be removed. Contact an administrator.')
    }
  }
  if ((replacementCover || input.removeCover) && resource.cover_image_path) {
    const { error: cleanupError } = await database.storage.from('covers').remove([resource.cover_image_path])
    if (cleanupError) {
      console.error('SOMA SMART old cover cleanup failed', cleanupError)
      throw new Error('The resource was updated, but its previous cover image could not be removed. Contact an administrator.')
    }
  }
}

export async function setResourcePublished(id: string, published: boolean): Promise<void> {
  const { error } = await client().from('resources').update({ status: published ? 'published' : 'draft' }).eq('id', id)
  if (error) failRequest('The publication status could not be changed. Please try again.', error)
}

export async function createCategory(name: string, description: string): Promise<void> {
  const { error } = await client().from('categories').insert({ name: name.trim(), description: description.trim() || null })
  if (error) failRequest('The category could not be added. Check that its name is unique.', error)
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  const { error } = await client().from('categories').update({ is_active: active }).eq('id', id)
  if (error) failRequest('The category status could not be changed. Please try again.', error)
}

export async function removeCategory(id: string): Promise<void> {
  const { error } = await client().from('categories').delete().eq('id', id)
  if (error) failRequest('The category could not be removed. It may still be assigned to resources.', error)
}

export async function createSubject(name: string, academicLevel: string): Promise<void> {
  const { error } = await client().from('subjects').insert({ name: name.trim(), academic_level: academicLevel })
  if (error) failRequest('The subject could not be added. Check that this subject and level are not already listed.', error)
}

export async function setSubjectActive(id: string, active: boolean): Promise<void> {
  const { error } = await client().from('subjects').update({ is_active: active }).eq('id', id)
  if (error) failRequest('The subject status could not be changed. Please try again.', error)
}

export async function deleteResource(resource: Resource): Promise<void> {
  const database = client()
  const { error: deleteError } = await database.from('resources').delete().eq('id', resource.id)
  if (deleteError) failRequest('The resource could not be deleted. Please try again.', deleteError)
  if (resource.file_path) {
    const { error: storageError } = await database.storage.from('documents').remove([resource.file_path])
    if (storageError) {
      console.error('SOMA SMART stored file cleanup failed', storageError)
      throw new Error('The resource record was deleted, but a stored file could not be removed. Contact an administrator.')
    }
  }
  if (resource.cover_image_path) {
    const { error: storageError } = await database.storage.from('covers').remove([resource.cover_image_path])
    if (storageError) {
      console.error('SOMA SMART cover cleanup failed', storageError)
      throw new Error('The resource was deleted, but its cover image could not be removed. Contact an administrator.')
    }
  }
}
