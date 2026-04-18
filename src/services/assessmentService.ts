/**
 * Assessment API service — wraps all backend endpoints for the three
 * ASD detection modules (eye tracking, speech analysis, MCQ) plus
 * report generation and history retrieval.
 */

import { request } from './api';

// ────────────────────────────────────────────────────────────────────
// Types mirroring the backend Pydantic schemas
// ────────────────────────────────────────────────────────────────────

// --- Eye Tracking ---

export interface EyeTrackingRequest {
  user_id: string;
  frames_base64: string[];
}

export interface GazeMetrics {
  gaze_points_count: number;
  avg_fixation_duration: number;
  attention_score: number;
  gaze_pattern_type: string;
  left_eye_openness: number;
  right_eye_openness: number;
  blink_rate: number;
  saccade_frequency: number;
  joint_attention_score: number;
}

export interface EyeTrackingResponse {
  assessment_id: string;
  status: string;
  metrics: GazeMetrics;
  asd_risk_score: number;
  confidence_score: number;
  insights: string[];
}

// --- Speech Analysis ---

export interface SpeechAnalysisRequest {
  user_id: string;
  audio_base64: string;
  audio_format: string;
}

export interface SpeechMetrics {
  words_per_minute: number;
  avg_pause_duration: number;
  clarity_score: number;
  vocal_variation_score: number;
  pitch_mean: number;
  pitch_std: number;
  energy_mean: number;
  speech_rate_variability: number;
  prosody_score: number;
  monotone_score: number;
}

export interface SpeechAnalysisResponse {
  assessment_id: string;
  status: string;
  metrics: SpeechMetrics;
  asd_risk_score: number;
  insights: string[];
}

// --- MCQ ---

export interface MCQAnswer {
  question_id: number;
  selected_option: number;
}

export interface MCQAssessmentRequest {
  user_id: string;
  answers: MCQAnswer[];
}

export interface QuestionScore {
  question_id: number;
  question_text: string;
  selected_option: string;
  score: number;
  asd_indicator_weight: number;
}

export interface MCQAssessmentResponse {
  assessment_id: string;
  status: string;
  question_scores: QuestionScore[];
  total_score: number;
  risk_level: string;
  asd_risk_score: number;
  behavioral_insights: string[];
}

// --- Questions (fetched from backend) ---

export interface MCQQuestion {
  id: number;
  question: string;
  domain: string;
  options: string[];
}

export interface MCQQuestionsResponse {
  questions: MCQQuestion[];
  total_count: number;
}

// --- Report ---

export interface GenerateReportRequest {
  user_id: string;
  eye_tracking_assessment_id?: string;
  speech_assessment_id?: string;
  mcq_assessment_id?: string;
}

export interface ModuleResult {
  module_name: string;
  score: number;
  risk_score: number;
  insights: string[];
  status: string;
}

export interface ReportResponse {
  report_id: string;
  user_id: string;
  overall_score: number;
  risk_level: string;
  risk_percentage: number;
  eye_tracking: ModuleResult;
  speech_analysis: ModuleResult;
  mcq_assessment: ModuleResult;
  recommendations: string[];
  created_at: string;
}

// --- History ---

export interface AssessmentHistoryItem {
  assessment_id: string;
  type: string;
  status: string;
  created_at: string;
}

export interface UserAssessmentHistory {
  user_id: string;
  assessments: AssessmentHistoryItem[];
  total_count: number;
}

// ────────────────────────────────────────────────────────────────────
// API calls
// ────────────────────────────────────────────────────────────────────

/** Submit eye tracking frames for analysis. */
export function submitEyeTracking(
  payload: EyeTrackingRequest,
): Promise<EyeTrackingResponse> {
  return request<EyeTrackingResponse>('/api/assessment/eye-tracking', {
    method: 'POST',
    body: payload,
    timeoutMs: 120_000, // eye tracking may take longer
  });
}

/** Submit audio recording for speech analysis. */
export function submitSpeechAnalysis(
  payload: SpeechAnalysisRequest,
): Promise<SpeechAnalysisResponse> {
  return request<SpeechAnalysisResponse>('/api/assessment/speech', {
    method: 'POST',
    body: payload,
    timeoutMs: 120_000,
  });
}

/** Submit MCQ answers for scoring. */
export function submitMCQAssessment(
  payload: MCQAssessmentRequest,
): Promise<MCQAssessmentResponse> {
  return request<MCQAssessmentResponse>('/api/assessment/mcq', {
    method: 'POST',
    body: payload,
  });
}

/** Fetch the list of MCQ questions from the backend. */
export function fetchMCQQuestions(): Promise<MCQQuestionsResponse> {
  return request<MCQQuestionsResponse>('/api/assessment/questions');
}

/** Generate a combined ASD assessment report. */
export function generateReport(
  payload: GenerateReportRequest,
): Promise<ReportResponse> {
  return request<ReportResponse>('/api/assessment/report/generate', {
    method: 'POST',
    body: payload,
  });
}

/** Get the latest report for a user. */
export function fetchReport(userId: string): Promise<ReportResponse> {
  return request<ReportResponse>(`/api/assessment/report/${userId}`);
}

/** Get assessment history for a user. */
export function fetchAssessmentHistory(
  userId: string,
): Promise<UserAssessmentHistory> {
  return request<UserAssessmentHistory>(`/api/assessment/history/${userId}`);
}

/** Health check — useful to verify connectivity before starting an assessment. */
export function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>('/healthz');
}
