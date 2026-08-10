import { supabase } from './supabase'

const toDocument = (row) => ({ id: row.id, contractId: row.contract_id, name: row.name, storagePath: row.storage_path, category: row.category, version: row.version, fileSize: Number(row.file_size), mimeType: row.mime_type, uploadedBy: row.uploaded_by, createdAt: row.created_at, accessLevel: row.access_level || 'All team' })

export async function fetchDocuments() {
  const { data, error } = await supabase.from('contract_documents').select('*').order('created_at', { ascending: false })
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw error
  }
  return data.map(toDocument)
}

export async function uploadContractDocument({ contractId, category, version, accessLevel, file }) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${accessLevel === 'Managers only' ? 'restricted' : 'all'}/${contractId}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from('contract-documents').upload(path, file, { contentType: file.type })
  if (uploadError) throw uploadError
  const { data, error } = await supabase.from('contract_documents').insert({ contract_id: contractId, name: file.name, storage_path: path, category, version: Number(version), file_size: file.size, mime_type: file.type, access_level: accessLevel || 'All team' }).select().single()
  if (error) { await supabase.storage.from('contract-documents').remove([path]); throw error }
  return toDocument(data)
}

export async function openContractDocument(document) {
  const { data, error } = await supabase.storage.from('contract-documents').createSignedUrl(document.storagePath, 60)
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export async function deleteContractDocument(document) {
  const { error: storageError } = await supabase.storage.from('contract-documents').remove([document.storagePath])
  if (storageError) throw storageError
  const { error } = await supabase.from('contract_documents').delete().eq('id', document.id)
  if (error) throw error
}
