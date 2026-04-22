import React, { createContext, useContext, useState, ReactNode } from 'react';
import type {
  GazeMetrics,
  EyeTrackingResponse,
  SpeechMetrics,
  SpeechAnalysisResponse,
  SpeechFeatures,
  BehavioralFlags,
  BehaviorScores,
  FrameAnalysisLog,
} from '../services/assessmentService';

interface AssessmentState {
  /** Assessment IDs returned by the backend after each module completes. */
  eyeTrackingAssessmentId: string | null;
  speechAssessmentId: string | null;
  mcqAssessmentId: string | null;

  /** Per-module ASD risk scores (0-100). */
  eyeTrackingScore: number | null;
  speechScore: number | null;
  mcqScore: number | null;

  /** Full model output for eye tracking. */
  eyeTrackingMetrics: GazeMetrics | null;
  eyeTrackingConfidence: number | null;
  eyeTrackingInsights: string[];
  eyeTrackingBehaviorScores: BehaviorScores | null;
  eyeTrackingFrameLog: FrameAnalysisLog[];
  eyeTrackingFeedbackMessage: string | null;
  eyeTrackingEyeDetected: boolean;

  /** Full model output for speech analysis. */
  speechMetrics: SpeechMetrics | null;
  speechFeatures: SpeechFeatures | null;
  speechBehavioralFlags: BehavioralFlags | null;
  speechLikelihood: number | null;
  speechConfidence: number | null;
  speechExplanation: string | null;
  speechDetected: boolean;
  speechInsights: string[];

  /** Tracks which modules the user has finished in this session. */
  eyeTrackingComplete: boolean;
  speechComplete: boolean;
  mcqComplete: boolean;

  /** Whether a combined report has been generated. */
  reportGenerated: boolean;
}

interface AssessmentContextType extends AssessmentState {
  setEyeTrackingResult: (result: EyeTrackingResponse) => void;
  setSpeechResult: (result: SpeechAnalysisResponse) => void;
  setMcqResult: (assessmentId: string, score: number) => void;
  markSpeechSkipped: () => void;
  setReportGenerated: (value: boolean) => void;
  resetAssessment: () => void;
  completedCount: number;
}

const initialState: AssessmentState = {
  eyeTrackingAssessmentId: null,
  speechAssessmentId: null,
  mcqAssessmentId: null,
  eyeTrackingScore: null,
  speechScore: null,
  mcqScore: null,
  eyeTrackingMetrics: null,
  eyeTrackingConfidence: null,
  eyeTrackingInsights: [],
  eyeTrackingBehaviorScores: null,
  eyeTrackingFrameLog: [],
  eyeTrackingFeedbackMessage: null,
  eyeTrackingEyeDetected: true,
  speechMetrics: null,
  speechFeatures: null,
  speechBehavioralFlags: null,
  speechLikelihood: null,
  speechConfidence: null,
  speechExplanation: null,
  speechDetected: true,
  speechInsights: [],
  eyeTrackingComplete: false,
  speechComplete: false,
  mcqComplete: false,
  reportGenerated: false,
};

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};

interface AssessmentProviderProps {
  children: ReactNode;
}

export const AssessmentProvider: React.FC<AssessmentProviderProps> = ({ children }) => {
  const [state, setState] = useState<AssessmentState>(initialState);

  const setEyeTrackingResult = (result: EyeTrackingResponse) => {
    setState(prev => ({
      ...prev,
      eyeTrackingAssessmentId: result.assessment_id,
      eyeTrackingScore: result.asd_risk_score,
      eyeTrackingMetrics: result.metrics,
      eyeTrackingConfidence: result.confidence_score,
      eyeTrackingInsights: result.insights,
      eyeTrackingBehaviorScores: result.behavior_scores ?? null,
      eyeTrackingFrameLog: result.frame_log ?? [],
      eyeTrackingFeedbackMessage: result.feedback_message ?? null,
      eyeTrackingEyeDetected: result.eye_detected ?? true,
      eyeTrackingComplete: true,
    }));
  };

  const setSpeechResult = (result: SpeechAnalysisResponse) => {
    setState(prev => ({
      ...prev,
      speechAssessmentId: result.assessment_id,
      speechScore: result.asd_risk_score,
      speechMetrics: result.metrics,
      speechFeatures: result.features ?? null,
      speechBehavioralFlags: result.behavioral_flags ?? null,
      speechLikelihood: typeof result.final_asd_likelihood === 'number' ? result.final_asd_likelihood : null,
      speechConfidence: typeof result.confidence === 'number' ? result.confidence : null,
      speechExplanation: result.explanation ?? null,
      speechDetected: result.speech_detected ?? true,
      speechInsights: result.insights,
      speechComplete: true,
    }));
  };

  const markSpeechSkipped = () => {
    setState(prev => ({
      ...prev,
      speechComplete: true,
      // Leave speechAssessmentId as null so it becomes undefined in report request
    }));
  };

  const setMcqResult = (assessmentId: string, score: number) => {
    setState(prev => ({
      ...prev,
      mcqAssessmentId: assessmentId,
      mcqScore: score,
      mcqComplete: true,
    }));
  };

  const setReportGenerated = (value: boolean) => {
    setState(prev => ({ ...prev, reportGenerated: value }));
  };

  const resetAssessment = () => {
    setState(initialState);
  };

  const completedCount =
    (state.eyeTrackingComplete ? 1 : 0) +
    (state.speechComplete ? 1 : 0) +
    (state.mcqComplete ? 1 : 0);

  return (
    <AssessmentContext.Provider
      value={{
        ...state,
        setEyeTrackingResult,
        setSpeechResult,
        setMcqResult,
        markSpeechSkipped,
        setReportGenerated,
        resetAssessment,
        completedCount,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
};
