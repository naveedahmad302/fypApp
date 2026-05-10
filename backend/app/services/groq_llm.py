"""Groq LLM service for autism prediction from speech analysis.

Uses Groq's LLM to analyze speech patterns and predict ASD risk
based on linguistic markers, communication patterns, and behavioral indicators.
"""

import logging
import json
from typing import Dict, Any, Optional
import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)


class GroqLLMService:
    """Service for autism prediction using Groq LLM."""
    
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.groq_api_key
        self.base_url = "https://api.groq.com/openai/v1"
        
        if not self.api_key:
            raise ValueError("Groq API key not configured")
    
    async def analyze_speech_for_autism(
        self, 
        transcription: str,
        speech_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze speech transcription for ASD indicators using Groq LLM.
        
        Args:
            transcription: Speech transcription text
            speech_metrics: Audio analysis metrics (pitch, tempo, etc.)
            
        Returns:
            Dictionary with ASD risk prediction and analysis
        """
        try:
            # Prepare comprehensive prompt for ASD analysis
            prompt = self._build_autism_analysis_prompt(transcription, speech_metrics)
            
            # Call Groq API
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama3-70b-8192",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert in autism spectrum disorder assessment and speech analysis. Analyze speech patterns for ASD indicators."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                "max_tokens": 1024,
                "temperature": 0.3
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                
                result = response.json()
                llm_response = result["choices"][0]["message"]["content"]
                
                # Parse LLM response
                return self._parse_llm_response(llm_response, speech_metrics)
                
        except httpx.HTTPError as e:
            logger.error(f"Groq API error: {e}")
            return self._fallback_analysis(transcription, speech_metrics)
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            return self._fallback_analysis(transcription, speech_metrics)
    
    def _build_autism_analysis_prompt(
        self, 
        transcription: str, 
        speech_metrics: Dict[str, Any]
    ) -> str:
        """Build comprehensive prompt for ASD analysis."""
        
        return f"""
        Analyze the following speech sample for Autism Spectrum Disorder indicators:

        TRANSCRIPTION:
        {transcription}

        SPEECH METRICS:
        - Average Pitch: {speech_metrics.get('avg_pitch', 'N/A')} Hz
        - Pitch Variability: {speech_metrics.get('pitch_std', 'N/A')}
        - Speech Rate: {speech_metrics.get('speech_rate', 'N/A')} words/minute
        - Pause Frequency: {speech_metrics.get('pause_frequency', 'N/A')}
        - Duration: {speech_metrics.get('duration', 'N/A')} seconds

        Please analyze for these ASD indicators:
        1. **Speech Patterns**: Echolalia, unusual intonation, monotonous speech
        2. **Communication Style**: Literal interpretation, difficulty with pragmatics
        3. **Social Communication**: Reciprocal conversation challenges
        4. **Behavioral Markers**: Repetitive language, restricted interests
        5. **Prosodic Features**: Abnormal rhythm, stress patterns

        Provide:
        1. ASD Risk Level (LOW/MODERATE/HIGH)
        2. Confidence Score (0-100)
        3. Key Indicators Found
        4. Detailed Analysis
        5. Recommendations

        Respond in JSON format:
        {{
            "asd_risk_score": <0-100>,
            "confidence_score": <0-100>,
            "risk_level": "<LOW|MODERATE|HIGH>",
            "key_indicators": ["<indicator1>", "<indicator2>"],
            "analysis": "<detailed explanation>",
            "recommendations": ["<rec1>", "<rec2>"]
        }}
        """
    
    def _parse_llm_response(self, llm_response: str, speech_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Parse LLM response and ensure valid structure."""
        try:
            # Extract JSON from response
            start_marker = "```json"
            end_marker = "```"
            start_idx = llm_response.find(start_marker)
            end_idx = llm_response.find(end_marker, start_idx + len(start_marker))
            
            if start_idx != -1 and end_idx != -1:
                json_str = llm_response[start_idx + len(start_marker):end_idx].strip()
                result = json.loads(json_str)
            else:
                # Try to parse entire response as JSON
                result = json.loads(llm_response)
            
            # Validate and enhance response
            return {
                "asd_risk_score": min(max(result.get("asd_risk_score", 50), 100), 0),
                "confidence_score": min(max(result.get("confidence_score", 75), 100), 0),
                "risk_level": result.get("risk_level", "MODERATE"),
                "key_indicators": result.get("key_indicators", []),
                "analysis": result.get("analysis", "Speech analysis completed"),
                "recommendations": result.get("recommendations", []),
                "llm_model": "llama3-70b-8192",
                "analysis_source": "groq_llm"
            }
            
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse LLM response: {e}")
            return self._fallback_analysis("", speech_metrics)
    
    def _fallback_analysis(self, transcription: str, speech_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Provide fallback analysis when LLM fails."""
        # Simple rule-based fallback
        pitch_variability = speech_metrics.get('pitch_std', 0)
        speech_rate = speech_metrics.get('speech_rate', 150)
        
        # Basic scoring
        risk_score = 50  # Default moderate
        
        if pitch_variability > 50 or speech_rate < 100 or speech_rate > 200:
            risk_score += 20
        
        if len(transcription) < 50:  # Very short response
            risk_score += 15
        
        risk_score = min(risk_score, 100)
        
        if risk_score >= 70:
            risk_level = "HIGH"
        elif risk_score >= 40:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"
        
        return {
            "asd_risk_score": risk_score,
            "confidence_score": 60,  # Lower confidence for fallback
            "risk_level": risk_level,
            "key_indicators": ["Limited speech data", "Acoustic anomalies"],
            "analysis": "Basic acoustic analysis - LLM unavailable",
            "recommendations": ["Complete full assessment", "Consider clinical evaluation"],
            "llm_model": "fallback_rule_based",
            "analysis_source": "fallback_acoustic"
        }


# Global instance
groq_llm_service = GroqLLMService()
