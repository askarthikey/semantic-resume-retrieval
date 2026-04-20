import { apiClient } from "./client";
import type {
  ResumeDetail,
  ResumeListResponse,
  SearchResponse,
  UploadResponse,
} from "./types";

export async function uploadResumes(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const { data } = await apiClient.post<UploadResponse>("/resumes/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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
