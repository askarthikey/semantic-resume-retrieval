export type UploadItem = {
  mongo_id: string;
  filename: string;
  candidate_name: string;
  upload_timestamp: string;
  file_storage?: ResumeFileStorage;
};

export type ResumeFileStorage = {
  bucket: string;
  object_key: string;
  mime_type: string;
  size_bytes: number;
  download_url?: string;
};

export type UploadFailure = {
  filename: string;
  error: string;
};

export type UploadResponse = {
  success: boolean;
  uploaded: UploadItem[];
  failed: UploadFailure[];
};

export type UploadJobAcceptedResponse = {
  job_id: string;
  status: string;
  total_files: number;
  message: string;
};

export type UploadJobFileStatus = {
  file_id: string;
  filename: string;
  status: string;
  error?: string;
  mongo_id?: string;
  candidate_name?: string;
};

export type UploadJobStatusResponse = {
  job_id: string;
  status: string;
  total_files: number;
  processed_files: number;
  success_count: number;
  failure_count: number;
  files: UploadJobFileStatus[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
};

export type SearchResult = {
  rank: number;
  mongo_id: string;
  candidate_name: string;
  filename: string;
  similarity_score: number;
  snippet: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  total: number;
  message?: string;
};

export type ResumeListItem = {
  mongo_id: string;
  filename: string;
  candidate_name: string;
  upload_timestamp: string;
  file_storage?: ResumeFileStorage;
};

export type ResumeListResponse = {
  resumes: ResumeListItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ResumeDetail = {
  mongo_id: string;
  filename: string;
  candidate_name: string;
  raw_text: string;
  upload_timestamp: string;
  file_storage?: ResumeFileStorage;
};
