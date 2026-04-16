import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AssessmentState {
  /** Assessment IDs returned by the backend after each module completes. */
  eyeTrackingAssessmentId: string | null;
  speechAssessmentId: string | null;
  mcqAssessmentId: string | null;

  /** Per-module ASD risk scores (0-100). */
  eyeTrackingScore: number | null;
  speechScore: number | null;
  mcqScore: number | null;

  /** Tracks which modules the user has finished in this session. */
  eyeTrackingComplete: boolean;
  speechComplete: boolean;
  mcqComplete: boolean;

  /** Whether a combined report has been generated. */
  reportGenerated: boolean;
}

interface AssessmentContextType extends AssessmentState {
  setEyeTrackingResult: (assessmentId: string, score: number) => void;
  setSpeechResult: (assessmentId: string, score: number) => void;
  setMcqResult: (assessmentId: string, score: number) => void;
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

  const setEyeTrackingResult = (assessmentId: string, score: number) => {
    setState(prev => ({
      ...prev,
      eyeTrackingAssessmentId: assessmentId,
      eyeTrackingScore: score,
      eyeTrackingComplete: true,
    }));
  };

  const setSpeechResult = (assessmentId: string, score: number) => {
    setState(prev => ({
      ...prev,
      speechAssessmentId: assessmentId,
      speechScore: score,
      speechComplete: true,
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
        setReportGenerated,
        resetAssessment,
        completedCount,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
};
