import { apiClient } from "./client";
import type {
  ResumeDetail,
  ResumeListResponse,
  SearchResponse,
  UploadJobAcceptedResponse,
  UploadJobStatusResponse,
  UploadResponse,
} from "./types";

const UPLOAD_REQUEST_TIMEOUT_MS = 120000;

export async function uploadResumes(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const { data } = await apiClient.post<UploadResponse>("/resumes/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function createUploadJob(files: File[]): Promise<UploadJobAcceptedResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const { data } = await apiClient.post<UploadJobAcceptedResponse>("/resumes/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_REQUEST_TIMEOUT_MS,
  });
  return data;
}

export async function getUploadJobStatus(jobId: string): Promise<UploadJobStatusResponse> {
  const { data } = await apiClient.get<UploadJobStatusResponse>(`/resumes/upload-jobs/${jobId}`);
  return data;
}

export async function searchResumes(query: string, topK: number): Promise<SearchResponse> {
  const { data } = await apiClient.post<SearchResponse>("/resumes/search", {
    query,
    top_k: topK,
  });
  return data;
}

export async function listResumes(page: number, pageSize: number): Promise<ResumeListResponse> {
  const { data } = await apiClient.get<ResumeListResponse>("/resumes", {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function getResumeDetail(mongoId: string): Promise<ResumeDetail> {
  const { data } = await apiClient.get<ResumeDetail>(`/resumes/${mongoId}`);
  return data;
}

export async function deleteResume(mongoId: string): Promise<void> {
  await apiClient.delete(`/resumes/${mongoId}`);
}
