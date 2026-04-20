export type UploadItem = {
  mongo_id: string;
  filename: string;
  candidate_name: string;
  upload_timestamp: string;
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
};
