/**
 * EyeModelFeaturesPanel
 * ─────────────────────
 * Renders the trained-model (v2 backend) feature dump that the Python
 * pipeline returns in `EyeTrackingResponse.model_features`.
 *
 * The panel is split into the four canonical groups the model was
 * trained on (Eye Position L/R, Pupil L/R, Point of Regard L/R) plus a
 * Prediction Result section and a developer/debug panel showing the
 * raw 14-vector. Naming and ordering match the backend `FEATURE_ORDER`
 * tuple exactly so the UI never disagrees with what the model receives.
 *
 * The component renders nothing when `model_features` is missing
 * (legacy backend) so it composes safely with the existing screen.
 */
import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import {
  Eye,
  Circle,
  Crosshair,
  Activity,
  Code2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react-native';
import CustomText from '../../../../components/CustomText';
import type {
  EyeFeatureSummary,
  EyeModelFeatures,
} from '../../../../services/assessmentService';

interface Props {
  features?: EyeModelFeatures | null;
}

interface FeatureGroupConfig {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  /** Substrings (case-insensitive) used to pick the matching feature names. */
  match: string[];
  /** Unit suffix shown alongside numeric values. */
  unit: string;
}

/**
 * The order here drives the on-screen layout. Each group's `match`
 * substrings filter the canonical FEATURE_ORDER names (e.g.
 * "Eye Position Right X [mm]"), so renaming features in the backend
 * automatically flows through without re-touching the UI.
 */
const GROUPS: FeatureGroupConfig[] = [
  {
    title: 'Eye Position',
    icon: Eye,
    iconColor: '#3B82F6',
    match: ['eye position'],
    unit: 'mm',
  },
  {
    title: 'Pupil Position',
    icon: Circle,
    iconColor: '#8B5CF6',
    match: ['pupil position'],
    unit: 'px',
  },
  {
    title: 'Point of Regard',
    icon: Crosshair,
    iconColor: '#10B981',
    match: ['point of regard'],
    unit: 'px',
  },
];

/** Format a numeric value defensively — guards against NaN / undefined. */
const fmt = (v: number | undefined | null, digits = 1): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return '∞';
  return v.toFixed(digits);
};

/** Single-row metric: feature name on the left, current+range on the right. */
const FeatureRow: React.FC<{ summary: EyeFeatureSummary; unit: string }> = ({
  summary,
  unit,
}) => (
  <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
    <View className="flex-1 pr-2">
      <CustomText weight={500} className="text-gray-700 text-xs">
        {summary.name}
      </CustomText>
      <CustomText weight={400} className="text-gray-400 text-[10px]">
        range {fmt(summary.min)} … {fmt(summary.max)} · σ {fmt(summary.std, 2)}
      </CustomText>
    </View>
    <View className="items-end">
      <CustomText weight={700} className="text-gray-900 text-sm">
        {fmt(summary.last)}
        <CustomText weight={400} className="text-gray-500 text-xs">
          {' '}
          {unit}
        </CustomText>
      </CustomText>
      <CustomText weight={400} className="text-gray-400 text-[10px]">
        μ {fmt(summary.mean)} {unit}
      </CustomText>
    </View>
  </View>
);

const SectionHeader: React.FC<{
  title: string;
  icon: React.ElementType;
  iconColor: string;
}> = ({ title, icon: Icon, iconColor }) => (
  <View className="flex-row items-center mb-2">
    <Icon size={16} color={iconColor} />
    <CustomText weight={600} className="text-gray-800 text-sm ml-2">
      {title}
    </CustomText>
  </View>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <View
    className={`bg-white p-4 rounded-2xl shadow-lg shadow-gray-200 mb-4 ${className ?? ''}`}
    style={{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    }}
  >
    {children}
  </View>
);

export const EyeModelFeaturesPanel: React.FC<Props> = ({ features }) => {
  const [debugOpen, setDebugOpen] = useState(false);

  /** Index features by name once for O(1) group lookups. */
  const byName = useMemo(() => {
    const m = new Map<string, EyeFeatureSummary>();
    features?.summary.forEach((s) => m.set(s.name.toLowerCase(), s));
    return m;
  }, [features?.summary]);

  // Nothing to render when the legacy backend is active.
  if (!features) {
    return null;
  }

  const probabilityPct = Math.round(features.asd_probability * 100);
  const confidencePct = Math.round(features.confidence * 100);
  const positiveLabel = features.label_classes[0] ?? 'ASD';
  const negativeLabel = features.label_classes[1] ?? 'Neurotypical';
  const probabilityColor =
    probabilityPct >= 60
      ? '#EF4444'
      : probabilityPct >= 30
        ? '#F59E0B'
        : '#22C55E';

  const lastFrame =
    features.per_frame.length > 0
      ? features.per_frame[features.per_frame.length - 1]
      : null;
  const noFrames = features.n_frames_used === 0;

  return (
    <View>
      {/* ─── Prediction summary ─── */}
      <Card>
        <View className="flex-row items-center justify-between mb-3">
          <SectionHeader
            title="Trained Model Prediction"
            icon={Activity}
            iconColor="#4A90E2"
          />
          <View className="bg-blue-50 px-2 py-0.5 rounded-full">
            <CustomText weight={500} className="text-[10px] text-blue-700">
              {features.backend} · {features.preprocessing}
            </CustomText>
          </View>
        </View>

        <View className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3 mb-2">
          <View className="flex-1">
            <CustomText weight={500} className="text-gray-500 text-xs">
              P({positiveLabel})
            </CustomText>
            <CustomText
              weight={700}
              className="text-2xl"
              style={{ color: probabilityColor }}
            >
              {probabilityPct}%
            </CustomText>
            <CustomText weight={400} className="text-gray-400 text-[11px]">
              P({negativeLabel}) {100 - probabilityPct}%
            </CustomText>
          </View>
          <View className="items-end">
            <CustomText weight={500} className="text-gray-500 text-xs">
              Confidence
            </CustomText>
            <CustomText weight={700} className="text-2xl text-gray-700">
              {confidencePct}%
            </CustomText>
            <CustomText weight={400} className="text-gray-400 text-[11px]">
              frames {features.n_frames_used} / {features.n_frames_total}
            </CustomText>
          </View>
        </View>

        {noFrames && (
          <View className="flex-row items-center bg-orange-50 p-2 rounded-lg">
            <AlertTriangle size={14} color="#D97706" />
            <CustomText
              weight={400}
              className="text-orange-700 text-xs ml-2 flex-1"
            >
              No frames produced a usable feature vector. Make sure your face is
              well-lit and centred in the camera.
            </CustomText>
          </View>
        )}
      </Card>

      {/* ─── Grouped feature sections ─── */}
      {GROUPS.map((group) => {
        const matched = features.summary.filter((s) =>
          group.match.some((m) => s.name.toLowerCase().includes(m)),
        );
        if (matched.length === 0) return null;

        return (
          <Card key={group.title}>
            <SectionHeader
              title={group.title}
              icon={group.icon}
              iconColor={group.iconColor}
            />
            {matched.map((s) => (
              <FeatureRow
                key={s.name}
                summary={byName.get(s.name.toLowerCase()) ?? s}
                unit={group.unit}
              />
            ))}
          </Card>
        );
      })}

      {/* ─── Developer / debug panel ─── */}
      <Card>
        <TouchableOpacity
          className="flex-row items-center justify-between"
          onPress={() => setDebugOpen((o) => !o)}
          activeOpacity={0.7}
        >
          <SectionHeader
            title="Developer · Raw Feature Vector"
            icon={Code2}
            iconColor="#6B7280"
          />
          {debugOpen ? (
            <ChevronUp size={18} color="#6B7280" />
          ) : (
            <ChevronDown size={18} color="#6B7280" />
          )}
        </TouchableOpacity>

        {debugOpen && (
          <View className="mt-3">
            <CustomText weight={400} className="text-gray-500 text-[11px] mb-2">
              Canonical 14-feature vector in the order the trained model expects.
              Latest frame shown first; scroll for older samples.
            </CustomText>

            <View className="bg-gray-900 rounded-lg p-3">
              <CustomText
                weight={500}
                className="text-emerald-300 text-[10px] mb-2"
              >
                FEATURE_ORDER
              </CustomText>
              {features.feature_order.map((name, i) => (
                <CustomText
                  key={name}
                  weight={400}
                  className="text-gray-300 text-[10px]"
                >
                  [{String(i).padStart(2, '0')}] {name}
                </CustomText>
              ))}
            </View>

            {lastFrame && (
              <View className="bg-gray-900 rounded-lg p-3 mt-2">
                <CustomText
                  weight={500}
                  className="text-emerald-300 text-[10px] mb-2"
                >
                  LATEST_VECTOR
                </CustomText>
                <CustomText
                  weight={400}
                  className="text-gray-300 text-[10px]"
                  selectable
                >
                  [{lastFrame.map((v) => v.toFixed(2)).join(', ')}]
                </CustomText>
              </View>
            )}

            {features.per_frame.length > 1 && (
              <View className="bg-gray-900 rounded-lg p-3 mt-2">
                <CustomText
                  weight={500}
                  className="text-emerald-300 text-[10px] mb-2"
                >
                  PER_FRAME (last {features.per_frame.length})
                </CustomText>
                <ScrollView style={{ maxHeight: 120 }}>
                  {features.per_frame
                    .slice()
                    .reverse()
                    .map((row, idx) => (
                      <CustomText
                        key={idx}
                        weight={400}
                        className="text-gray-400 text-[9px] mb-0.5"
                        selectable
                      >
                        #{features.per_frame.length - idx}: [
                        {row.map((v) => v.toFixed(1)).join(', ')}]
                      </CustomText>
                    ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </Card>
    </View>
  );
};

export default EyeModelFeaturesPanel;
