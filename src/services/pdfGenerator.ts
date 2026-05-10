/**
 * PDF Generation Service for Autism Assessment Reports
 * Creates properly structured PDF documents with formatted content
 */

interface ReportData {
  overall_score: number;
  risk_percentage: number;
  risk_level: string;
  eye_tracking: any;
  speech_analysis: any;
  mcq_assessment: any;
  recommendations: string[];
}

interface TherapyResource {
  name: string;
  website: string;
  description: string;
  phone?: string;
  email?: string;
  services: string[];
}


/**
 * Generate HTML content for autism assessment report with clickable links
 */
export const generatePDFContent = (report: ReportData): string => {
  const currentDate = new Date().toLocaleDateString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autism Assessment Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            border-left: 4px solid #3498db;
            padding-left: 10px;
            margin-top: 30px;
        }
        h3 {
            color: #555;
            margin-top: 20px;
        }
        .risk-high { color: #e74c3c; font-weight: bold; }
        .risk-moderate { color: #f39c12; font-weight: bold; }
        .risk-low { color: #27ae60; font-weight: bold; }
        .metric {
            background-color: #ecf0f1;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
        }
        .recommendation {
            background-color: #e8f5e8;
            padding: 10px;
            margin: 5px 0;
            border-left: 3px solid #27ae60;
        }
        .resource {
            background-color: #fff3cd;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
        }
        .resource h4 {
            margin: 0 0 5px 0;
            color: #856404;
        }
        .resource a {
            color: #007bff;
            text-decoration: none;
            font-weight: bold;
        }
        .resource a:hover {
            text-decoration: underline;
        }
        .disclaimer {
            background-color: #f8d7da;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            border-left: 4px solid #dc3545;
            color: #721c24;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #6c757d;
            font-size: 0.9em;
        }
        ul {
            padding-left: 20px;
        }
        li {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>AUTISM SPECTRUM DISORDER ASSESSMENT REPORT</h1>
        <p><strong>Generated on:</strong> ${currentDate}</p>
        
        <h2>OVERALL ASSESSMENT SUMMARY</h2>
        <div class="metric">
            <p><strong>Risk Score:</strong> ${report.risk_percentage}/100</p>
            <p><strong>Risk Level:</strong> <span class="risk-${report.risk_level.toLowerCase()}">${report.risk_level.toUpperCase()}</span></p>
            <p><strong>Assessment Weight Distribution:</strong> MCQ (50%), Speech Analysis (25%), Eye Tracking (25%)</p>
        </div>
        
        <h2>DETAILED ASSESSMENT RESULTS</h2>
        
        <h3>1. EYE TRACKING ASSESSMENT (25% Weight)</h3>
        <div class="metric">
            <p><strong>Status:</strong> ${report.eye_tracking?.status || 'Not Completed'}</p>
            <p><strong>Risk Score:</strong> ${Math.round(report.eye_tracking?.risk_score || 0)}/100</p>
            ${report.eye_tracking?.status === 'completed' ? `
            <p><strong>Key Metrics:</strong></p>
            <ul>
                <li>Attention Score: ${report.eye_tracking?.attention_score || 0}/100</li>
                <li>Gaze Pattern: ${report.eye_tracking?.gaze_pattern_type || 'N/A'}</li>
                <li>Confidence Level: ${report.eye_tracking?.confidence || 0}%</li>
            </ul>
            ` : ''}
        </div>
        
        <h3>2. SPEECH ANALYSIS ASSESSMENT (25% Weight)</h3>
        <div class="metric">
            <p><strong>Status:</strong> ${report.speech_analysis?.status || 'Not Completed'}</p>
            <p><strong>Risk Score:</strong> ${Math.round(report.speech_analysis?.risk_score || 0)}/100</p>
            ${report.speech_analysis?.status === 'completed' ? `
            <p><strong>Key Metrics:</strong></p>
            <ul>
                <li>Words Per Minute: ${report.speech_analysis?.words_per_minute || 0}</li>
                <li>Monotone Score: ${report.speech_analysis?.monotone_score || 0}%</li>
                <li>Clarity Score: ${report.speech_analysis?.clarity_score || 0}/100</li>
                <li>Confidence Level: ${report.speech_analysis?.confidence || 0}%</li>
            </ul>
            ` : ''}
        </div>
        
        <h3>3. MCQ BEHAVIORAL ASSESSMENT (50% Weight)</h3>
        <div class="metric">
            <p><strong>Status:</strong> ${report.mcq_assessment?.status || 'Not Completed'}</p>
            <p><strong>Risk Score:</strong> ${Math.round(report.mcq_assessment?.risk_score || 0)}/100</p>
            ${report.mcq_assessment?.status === 'completed' ? `
            <p><strong>Key Metrics:</strong></p>
            <ul>
                <li>Total Score: ${report.mcq_assessment?.total_score || 0}/100</li>
                <li>Max Possible: ${report.mcq_assessment?.max_possible_score || 0}/100</li>
                <li>Question Count: ${report.mcq_assessment?.question_scores?.length || 0}</li>
            </ul>
            ` : ''}
        </div>
        
        <h2>RISK LEVEL INTERPRETATION</h2>
        <div class="metric">
            ${getRiskLevelInterpretationHTML(report.risk_level)}
        </div>
        
        <h2>PERSONALIZED RECOMMENDATIONS</h2>
        ${report.recommendations ? report.recommendations.map((rec, idx) => 
            `<div class="recommendation"><strong>${idx + 1}.</strong> ${rec}</div>`
        ).join('') : '<div class="recommendation">No recommendations available</div>'}
        
        <h2>THERAPY RESOURCES</h2>
        ${getTherapyResourcesHTML()}
        
        <div class="disclaimer">
            <h3>MEDICAL DISCLAIMER</h3>
            <p>This assessment is a screening tool and should not be used as a definitive diagnosis.</p>
            <p>Professional clinical evaluation by qualified healthcare providers is required for accurate diagnosis.</p>
            <p>For immediate concerns, consult: Developmental pediatrician, Child psychologist, Autism specialist.</p>
        </div>
        
        <div class="footer">
            <p>Report generated by FYP Autism Assessment System</p>
        </div>
    </div>
</body>
</html>`;
};

/**
 * Get risk level interpretation based on score (HTML format)
 */
const getRiskLevelInterpretationHTML = (riskLevel: string): string => {
  switch (riskLevel.toLowerCase()) {
    case 'high':
      return `<p><strong>HIGH RISK (Score ≥60):</strong> Strong indicators of autism spectrum disorder detected.
Multiple assessment modules show consistent patterns associated with ASD. 
Immediate professional evaluation recommended for comprehensive diagnostic assessment.</p>
<p><strong>Recommended Actions:</strong></p>
<ul>
<li>Schedule appointment with developmental pediatrician or autism specialist</li>
<li>Consider comprehensive diagnostic evaluation</li>
<li>Explore early intervention services</li>
<li>Develop structured support strategies</li>
</ul>
<p>Clinical indicators present across multiple domains suggest significant likelihood of ASD.
Early identification and intervention are crucial for optimal developmental outcomes.</p>`;

    case 'moderate':
      return `<p><strong>MODERATE RISK (Score 41-59):</strong> Some indicators of autism spectrum disorder present.
Assessment results show mixed patterns with some ASD-associated characteristics.
Further professional evaluation recommended for clarification.</p>
<p><strong>Recommended Actions:</strong></p>
<ul>
<li>Discuss results with healthcare provider</li>
<li>Consider targeted assessment for specific areas of concern</li>
<li>Monitor developmental progress closely</li>
<li>Explore supportive therapies if needed</li>
</ul>
<p>Some behavioral patterns may indicate emerging ASD traits or other developmental considerations.
Professional guidance can help determine appropriate next steps for support.</p>`;

    case 'low':
      return `<p><strong>LOW RISK (Score <41):</strong> Assessment results within typical developmental ranges.
No significant indicators of autism spectrum disorder detected at this time.
Continue monitoring development and consult professional if concerns arise.</p>
<p><strong>Recommended Actions:</strong></p>
<ul>
<li>Continue regular developmental monitoring</li>
<li>Maintain supportive environment for healthy development</li>
<li>Consult professional if new concerns emerge</li>
<li>Follow typical developmental milestone checklists</li>
</ul>
<p>Current assessment patterns suggest typical development with no immediate ASD concerns.
Ongoing observation and regular check-ups support healthy developmental progression.</p>`;

    default:
      return '<p><strong>UNKNOWN RISK LEVEL:</strong> Unable to determine risk interpretation.</p>';
  }
};

/**
 * Get risk level interpretation based on score (plain text format - kept for backward compatibility)
 */
const getRiskLevelInterpretation = (riskLevel: string): string => {
  switch (riskLevel.toLowerCase()) {
    case 'high':
      return `HIGH RISK (Score ≥60): Strong indicators of autism spectrum disorder detected.
Multiple assessment modules show consistent patterns associated with ASD. 
Immediate professional evaluation recommended for comprehensive diagnostic assessment.

Recommended Actions:
• Schedule appointment with developmental pediatrician or autism specialist
• Consider comprehensive diagnostic evaluation
• Explore early intervention services
• Develop structured support strategies

Clinical indicators present across multiple domains suggest significant likelihood of ASD.
Early identification and intervention are crucial for optimal developmental outcomes.`;

    case 'moderate':
      return `MODERATE RISK (Score 41-59): Some indicators of autism spectrum disorder present.
Assessment results show mixed patterns with some ASD-associated characteristics.
Further professional evaluation recommended for clarification.

Recommended Actions:
• Discuss results with healthcare provider
• Consider targeted assessment for specific areas of concern
• Monitor developmental progress closely
• Explore supportive therapies if needed

Some behavioral patterns may indicate emerging ASD traits or other developmental considerations.
Professional guidance can help determine appropriate next steps for support.`;

    case 'low':
      return `LOW RISK (Score <41): Assessment results within typical developmental ranges.
No significant indicators of autism spectrum disorder detected at this time.
Continue monitoring development and consult professional if concerns arise.

Recommended Actions:
• Continue regular developmental monitoring
• Maintain supportive environment for healthy development
• Consult professional if new concerns emerge
• Follow typical developmental milestone checklists

Current assessment patterns suggest typical development with no immediate ASD concerns.
Ongoing observation and regular check-ups support healthy developmental progression.`;

    default:
      return 'UNKNOWN RISK LEVEL: Unable to determine risk interpretation.';
  }
};

/**
 * Get therapy resources for parents (HTML format with clickable links)
 */
const getTherapyResourcesHTML = (): string => {
  const resources: TherapyResource[] = [
    {
      name: "Autism Speaks",
      website: "https://www.autismspeaks.org",
      description: "Comprehensive autism resource with screening tools, family services, and advocacy",
      phone: "1-800-288-4762",
      services: ["Screening Tools", "Family Services", "Resource Guide", "Advocacy"]
    },
    {
      name: "American Academy of Pediatrics",
      website: "https://www.aap.org",
      description: "Developmental guidelines and pediatrician referrals for autism evaluation",
      services: ["Developmental Screening", "Pediatrician Finder", "Clinical Guidelines"]
    },
    {
      name: "Autism Science Foundation",
      website: "https://www.autismscience.org",
      description: "Research-based autism interventions and therapy resources",
      services: ["Research Articles", "Intervention Strategies", "Training Programs"]
    },
    {
      name: "National Autism Center",
      website: "https://www.autismcenter.org",
      description: "Information on autism therapies, education, and support services",
      services: ["Therapy Directory", "Educational Resources", "Parent Training"]
    },
    {
      name: "Early Intervention Services",
      website: "https://www.earlyinterventionsupport.org",
      description: "Early childhood intervention programs and therapy services",
      phone: "1-800-695-0285",
      services: ["Early Intervention", "Therapy Programs", "Family Support"]
    },
    {
      name: "Applied Behavior Analysis (ABA) Resources",
      website: "https://www.abainternational.org",
      description: "ABA therapy providers and certification information",
      services: ["ABA Provider Directory", "Therapy Guidelines", "Training Resources"]
    },
    {
      name: "Speech Therapy Resources",
      website: "https://www.asha.org",
      description: "American Speech-Language-Hearing Association resources and therapist finder",
      services: ["Therapist Finder", "Speech Resources", "Clinical Guidelines"]
    },
    {
      name: "Occupational Therapy Resources",
      website: "https://www.aota.org",
      description: "American Occupational Therapy Association resources and provider directory",
      services: ["Therapist Directory", "Therapy Resources", "Activity Ideas"]
    },
    {
      name: "Social Skills Training",
      website: "https://www.socialskillstraining.com",
      description: "Social skills development programs and training resources",
      services: ["Training Programs", "Social Groups", "Skill Building"]
    }
  ];

  return resources.map((resource, idx) => `
<div class="resource">
    <h4>${idx + 1}. ${resource.name}</h4>
    <p><strong>Website:</strong> <a href="${resource.website}" target="_blank">${resource.website}</a></p>
    <p><strong>Description:</strong> ${resource.description}</p>
    ${resource.phone ? `<p><strong>Phone:</strong> ${resource.phone}</p>` : ''}
    <p><strong>Services:</strong> ${resource.services.join(', ')}</p>
</div>
`).join('');
};

/**
 * Get therapy resources for parents (plain text format - kept for backward compatibility)
 */
const getTherapyResources = (): string => {
  const resources: TherapyResource[] = [
    {
      name: "Autism Speaks",
      website: "www.autismspeaks.org",
      description: "Comprehensive autism resource with screening tools, family services, and advocacy",
      phone: "1-800-288-4762",
      services: ["Screening Tools", "Family Services", "Resource Guide", "Advocacy"]
    },
    {
      name: "American Academy of Pediatrics",
      website: "www.aap.org",
      description: "Developmental guidelines and pediatrician referrals for autism evaluation",
      services: ["Developmental Screening", "Pediatrician Finder", "Clinical Guidelines"]
    },
    {
      name: "Autism Science Foundation",
      website: "www.autismscience.org",
      description: "Research-based autism interventions and therapy resources",
      services: ["Research Articles", "Intervention Strategies", "Training Programs"]
    },
    {
      name: "National Autism Center",
      website: "www.autismcenter.org",
      description: "Information on autism therapies, education, and support services",
      services: ["Therapy Directory", "Educational Resources", "Parent Training"]
    },
    {
      name: "Early Intervention Services",
      website: "www.earlyinterventionsupport.org",
      description: "Early childhood intervention programs and therapy services",
      phone: "1-800-695-0285",
      services: ["Early Intervention", "Therapy Programs", "Family Support"]
    },
    {
      name: "Applied Behavior Analysis (ABA) Resources",
      website: "www.abainternational.org",
      description: "ABA therapy providers and certification information",
      services: ["ABA Provider Directory", "Therapy Guidelines", "Training Resources"]
    },
    {
      name: "Speech Therapy Resources",
      website: "www.asha.org",
      description: "American Speech-Language-Hearing Association resources and therapist finder",
      services: ["Therapist Finder", "Speech Resources", "Clinical Guidelines"]
    },
    {
      name: "Occupational Therapy Resources",
      website: "www.aota.org",
      description: "American Occupational Therapy Association resources and provider directory",
      services: ["Therapist Directory", "Therapy Resources", "Activity Ideas"]
    },
    {
      name: "Social Skills Training",
      website: "www.socialskillstraining.com",
      description: "Social skills development programs and training resources",
      services: ["Training Programs", "Social Groups", "Skill Building"]
    }
  ];

  return resources.map((resource, idx) => `
${idx + 1}. ${resource.name}
   Website: ${resource.website}
   Description: ${resource.description}
   ${resource.phone ? `Phone: ${resource.phone}` : ''}
   Services: ${resource.services.join(', ')}
   
`).join('\n');
};

import { Alert, Platform, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';

/**
 * Request storage permission on Android
 */
const requestStoragePermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true; // iOS doesn't need explicit storage permission for app directory
  }

  try {
    // For Android 11+ (API 30+), we don't need storage permission for app directories
    // But for Android 10 and below, we need permission for external storage
    const androidVersion = Platform.Version;
    if (typeof androidVersion === 'number' && androidVersion >= 30) {
      return true; // Android 11+ doesn't need storage permission for app directories
    }

    // Request storage permission for older Android versions
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'This app needs storage access to save your assessment report.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
};

/**
 * Download autism assessment report as a text file
 * Creates and saves the report to the device's Downloads folder
 */
export const downloadPDFReport = async (report: ReportData): Promise<void> => {
  try {
    // Request storage permission first
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Storage permission is required to save the report. Please grant permission and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    const reportContent = generatePDFContent(report);
    const fileName = `Autism_Assessment_Report_${new Date().toISOString().split('T')[0]}.html`;
    
    let filePath: string;
    let downloadDir: string;
    
    if (Platform.OS === 'android') {
      // For Android, try Downloads folder first, fallback to app's external files directory
      try {
        downloadDir = RNFS.DownloadDirectoryPath || RNFS.ExternalDirectoryPath;
        filePath = `${downloadDir}/${fileName}`;
        
        // Test if we can write to Downloads directory
        await RNFS.writeFile(filePath, reportContent, 'utf8');
      } catch (downloadError) {
        console.warn('Cannot write to Downloads folder, using app directory:', downloadError);
        // Fallback to app's external files directory
        downloadDir = RNFS.ExternalDirectoryPath;
        filePath = `${downloadDir}/${fileName}`;
        await RNFS.writeFile(filePath, reportContent, 'utf8');
      }
    } else {
      // iOS: Use Documents directory
      downloadDir = RNFS.DocumentDirectoryPath;
      filePath = `${downloadDir}/${fileName}`;
      await RNFS.writeFile(filePath, reportContent, 'utf8');
    }
    
    console.log('Report saved successfully to:', filePath);
    
    // Show success message with file location
    const successMessage = Platform.OS === 'android'
      ? `Your autism assessment report has been saved as:\n${fileName}\n\nFile location: Downloads folder\n\nOpen the HTML file in any web browser to view the report with clickable links.`
      : `Your autism assessment report has been saved as:\n${fileName}\n\nFile location: Documents folder\n\nOpen the HTML file in any web browser to view the report with clickable links.`;
    
    Alert.alert(
      'Report Downloaded Successfully',
      successMessage,
      [
        { 
          text: 'OK', 
          onPress: () => console.log('Report download acknowledged') 
        }
      ]
    );
    
    console.log('PDF report saved successfully to device');
  } catch (error) {
    console.error('Failed to save report:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to save the report.';
    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        errorMessage = 'Storage permission denied. Please grant storage permissions and try again.';
      } else if (error.message.includes('space')) {
        errorMessage = 'Insufficient storage space. Please free up space and try again.';
      } else if (error.message.includes('directory')) {
        errorMessage = 'Cannot access storage directory. Please check your device settings.';
      }
    }
    
    Alert.alert('Download Failed', errorMessage);
  }
};
