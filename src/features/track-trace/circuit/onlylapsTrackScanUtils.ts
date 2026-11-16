// Circuit extraction from Apex88Vent/OnlyLaps-app @ 22f372508582fb43d56b66947c26740233bcdb19.
// See README.md for provenance and compatibility changes.
export type TrackScanStage =
  | "intro"
  | "permission_check"
  | "gps_location_scan"
  | "nearby_track_results"
  | "track_name_or_select"
  | "track_characteristics"
  | "outside_ready"
  | "outside_recording"
  | "start_finish_recording"
  | "inside_recording"
  | "review"
  | "saved";

export type GpsPoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: string;
};

export type BoundingBox = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export type CenterPoint = {
  lat: number;
  lng: number;
};

export const trackTypeOptions = [
  { value: "dirt_oval", label: "Dirt Oval" },
  { value: "pavement_oval", label: "Pavement Oval" },
  { value: "road_course", label: "Road Course" }
] as const;

export const trackShapeOptions = [
  { value: "paperclip_oval", label: "Paperclip Oval" },
  { value: "symmetrical_oval", label: "Symmetrical Oval" },
  { value: "d_shaped_oval", label: "D-Shaped Oval" },
  { value: "tri_oval", label: "Tri-Oval" },
  { value: "egg_shaped_oval", label: "Egg-Shaped Oval" },
  { value: "dogleg_oval", label: "Dogleg Oval" },
  { value: "flat_oval", label: "Flat Oval" },
  { value: "high_banked_oval", label: "High-Banked Oval" },
  { value: "short_track_oval", label: "Short Track Oval" },
  { value: "custom_unknown", label: "Custom Oval / Unknown" }
] as const;

export const trackLengthOptions = [
  "1/8 mile",
  "1/5 mile",
  "1/4 mile",
  "1/3 mile",
  "3/8 mile",
  "1/2 mile",
  "5/8 mile",
  "3/4 mile",
  "1 mile",
  "1.5 miles",
  "2 miles",
  "Custom / Unknown"
] as const;

export type TrackTypeValue = (typeof trackTypeOptions)[number]["value"];
export type TrackShapeValue = (typeof trackShapeOptions)[number]["value"];

export type TrackScanMetadata = {
  trackType: TrackTypeValue | null;
  trackShape: TrackShapeValue | null;
  trackLength: string | null;
};

export type GpsSummary = {
  outsidePoints: number;
  startFinishPoints: number;
  insidePoints: number;
  totalPoints: number;
  averageAccuracy: number | null;
  worstAccuracy: number | null;
  center: CenterPoint | null;
  bbox: BoundingBox | null;
  areaKey: string | null;
};

export type SavedTrackMap = {
  id: string;
  track_name: string;
  area_key: string;
  facility_key: string | null;
  facility_name: string | null;
  center_lat: number;
  center_lng: number;
  bbox: BoundingBox;
  outside_path: GpsPoint[];
  start_finish_path: GpsPoint[];
  inside_path: GpsPoint[];
  gps_summary: GpsSummary | null;
  notes: string | null;
  version: number | null;
  is_active: boolean | null;
  supersedes_track_map_id: string | null;
  track_type: TrackTypeValue | null;
  track_shape: TrackShapeValue | null;
  track_length: string | null;
  created_by: string | null;
  user_id: string | null;
  created_at: string | null;
  source: string | null;
  description: string | null;
  track_length_meters: number | null;
  base_layer: TelemetryBaseLayer | null;
  preview_bounds: PreviewBounds | null;
  geojson: Record<string, unknown> | null;
  map_source: string | null;
  scan_status: "scanned" | "unscanned";
  map_confidence: number | null;
  start_finish_source: "scanned" | "automatic" | "manual" | null;
  generated_from_session_id: string | null;
  generated_at: string | null;
  direction: "clockwise" | "counterclockwise" | "unknown" | null;
  estimated_length_meters: number | null;
  publication_status: "private" | "published";
  is_open_route: boolean;
  representative_path_raw: GpsPoint[];
  representative_path_smoothed: GpsPoint[];
  automatic_start_finish_data: Record<string, unknown> | null;
  manual_start_finish_data: Record<string, unknown> | null;
  revision_history: Array<Record<string, unknown>>;
  corner_definitions?: Record<string, unknown> | null;
  corner_detection_version?: string | null;
};

export type NearbyTrackMap = {
  track: SavedTrackMap;
  distanceMeters: number;
  isInMyTracks: boolean;
};

export type FacilityTrackGroup = {
  facilityKey: string;
  facilityName: string | null;
  tracks: NearbyTrackMap[];
};

export type MyTrackRow = {
  id: string;
  created_at: string | null;
  user_id: string;
  track_map_id: string;
  nickname: string | null;
  is_default: boolean;
  last_used_at: string | null;
};

export type MyTrack = MyTrackRow & {
  track: SavedTrackMap;
};

export type PreviewPoint = {
  x: number;
  y: number;
};

export type PreviewBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type TelemetryBaseLayer = {
  type: "generated_from_scan" | "generated_from_gumball";
  trackType: TrackTypeValue | null;
  trackShape: TrackShapeValue | null;
  trackLength: string | null;
  outsidePathPreview: PreviewPoint[];
  insidePathPreview: PreviewPoint[];
  startFinishPreview: PreviewPoint[];
  centerlinePreview: PreviewPoint[];
  templatePath: PreviewPoint[];
  createdAt: string;
};

export type NormalizedPreviewPaths = {
  outside: PreviewPoint[];
  startFinish: PreviewPoint[];
  inside: PreviewPoint[];
  current: PreviewPoint | null;
  previewBounds: PreviewBounds | null;
};

type NormalizeTrackCoordinatesInput = {
  outsidePath: GpsPoint[];
  startFinishLinePath: GpsPoint[];
  insidePath: GpsPoint[];
  currentPoint?: GpsPoint | null;
  width?: number;
  height?: number;
  padding?: number;
};

type GenerateOvalTemplateInput = {
  trackShape?: TrackShapeValue | null;
  trackLength?: string | null;
  width?: number;
  height?: number;
  padding?: number;
};

type BuildTelemetryBaseLayerInput = NormalizeTrackCoordinatesInput & {
  trackType?: TrackTypeValue | null;
  trackShape?: TrackShapeValue | null;
  trackLength?: string | null;
  createdAt?: string;
};

export const nearbyTrackThresholdMeters = 3218.688;

const metersPerEarthRadius = 6371000;
const ovalTrackTypes: TrackTypeValue[] = ["dirt_oval", "pavement_oval"];
const trackTypeAliases: Record<string, TrackTypeValue> = {
  dirtoval: "dirt_oval",
  dirttrackoval: "dirt_oval",
  dirttrack: "dirt_oval",
  clayoval: "dirt_oval",
  pavementoval: "pavement_oval",
  pavedoval: "pavement_oval",
  asphaltoval: "pavement_oval",
  roadcourse: "road_course",
  roadcircuit: "road_course",
  circuit: "road_course"
};

function roundNumber(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function allTrackPoints(
  outsidePath: GpsPoint[],
  startFinishPath: GpsPoint[],
  insidePath: GpsPoint[]
) {
  return [...outsidePath, ...startFinishPath, ...insidePath];
}

export function calculateDistanceMeters(pointA: CenterPoint, pointB: CenterPoint) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * metersPerEarthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateBoundingBox(points: GpsPoint[]): BoundingBox | null {
  if (points.length === 0) {
    return null;
  }

  return points.reduce<BoundingBox>(
    (bbox, point) => ({
      minLat: Math.min(bbox.minLat, point.lat),
      minLng: Math.min(bbox.minLng, point.lng),
      maxLat: Math.max(bbox.maxLat, point.lat),
      maxLng: Math.max(bbox.maxLng, point.lng)
    }),
    {
      minLat: points[0].lat,
      minLng: points[0].lng,
      maxLat: points[0].lat,
      maxLng: points[0].lng
    }
  );
}

export function calculateCenterPoint(points: GpsPoint[]): CenterPoint | null {
  if (points.length === 0) {
    return null;
  }

  const totals = points.reduce(
    (accumulator, point) => ({
      lat: accumulator.lat + point.lat,
      lng: accumulator.lng + point.lng
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: roundNumber(totals.lat / points.length),
    lng: roundNumber(totals.lng / points.length)
  };
}

export function generateAreaKey(lat: number, lng: number) {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

export function generateFacilityKey(lat: number, lng: number) {
  return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

export function calculateAreaKey(point: CenterPoint | null) {
  if (!point) {
    return null;
  }

  return generateAreaKey(point.lat, point.lng);
}

export function normalizeTrackTypeValue(value: string | null | undefined): TrackTypeValue | null {
  if (!value) {
    return null;
  }

  const directValue = value.trim();

  if (trackTypeOptions.some((option) => option.value === directValue)) {
    return directValue as TrackTypeValue;
  }

  const compactValue = directValue.toLowerCase().replace(/[^a-z0-9]/g, "");

  return trackTypeAliases[compactValue] ?? null;
}

export function isTrackTypeValue(value: string | null | undefined): value is TrackTypeValue {
  return normalizeTrackTypeValue(value) !== null;
}

export function isTrackShapeValue(value: string | null | undefined): value is TrackShapeValue {
  return trackShapeOptions.some((option) => option.value === value);
}

export function isOvalTrackType(
  value: TrackTypeValue | "" | null | undefined
): value is "dirt_oval" | "pavement_oval" {
  return ovalTrackTypes.includes(value as TrackTypeValue);
}

export function getTrackTypeLabel(value: TrackTypeValue | null | undefined) {
  return trackTypeOptions.find((option) => option.value === value)?.label ?? "Unknown";
}

export function getTrackShapeLabel(value: TrackShapeValue | null | undefined) {
  return trackShapeOptions.find((option) => option.value === value)?.label ?? "Unknown";
}

export function formatTrackMetadataSummary(metadata: TrackScanMetadata | null | undefined) {
  if (!metadata?.trackType) {
    return null;
  }

  const parts = [getTrackTypeLabel(metadata.trackType)];

  if (isOvalTrackType(metadata.trackType)) {
    if (metadata.trackShape) {
      parts.push(getTrackShapeLabel(metadata.trackShape));
    }

    if (metadata.trackLength) {
      parts.push(metadata.trackLength);
    }
  }

  return parts.join(" / ");
}

export function summarizeGpsAccuracy(
  outsidePath: GpsPoint[],
  startFinishPath: GpsPoint[],
  insidePath: GpsPoint[]
): GpsSummary {
  const points = allTrackPoints(outsidePath, startFinishPath, insidePath);
  const accuracies = points
    .map((point) => point.accuracy)
    .filter((accuracy): accuracy is number => accuracy !== null && Number.isFinite(accuracy));
  const center = calculateCenterPoint(points);

  return {
    outsidePoints: outsidePath.length,
    startFinishPoints: startFinishPath.length,
    insidePoints: insidePath.length,
    totalPoints: points.length,
    averageAccuracy:
      accuracies.length > 0
        ? roundNumber(
            accuracies.reduce((total, accuracy) => total + accuracy, 0) / accuracies.length,
            1
          )
        : null,
    worstAccuracy: accuracies.length > 0 ? roundNumber(Math.max(...accuracies), 1) : null,
    center,
    bbox: calculateBoundingBox(points),
    areaKey: calculateAreaKey(center)
  };
}

export function shouldAddGpsPoint(
  previousPoint: GpsPoint | null | undefined,
  nextPoint: GpsPoint,
  minimumDistanceMeters = 1,
  minimumElapsedMs = 1000
) {
  if (!previousPoint) {
    return true;
  }

  const distanceMeters = calculateDistanceMeters(previousPoint, nextPoint);

  if (distanceMeters >= minimumDistanceMeters) {
    return true;
  }

  const previousTime = Date.parse(previousPoint.timestamp);
  const nextTime = Date.parse(nextPoint.timestamp);

  if (!Number.isFinite(previousTime) || !Number.isFinite(nextTime)) {
    return false;
  }

  return nextTime - previousTime >= minimumElapsedMs;
}

function getTrackLengthScale(trackLength?: string | null) {
  if (!trackLength || trackLength === "Custom / Unknown") {
    return {
      width: 1,
      height: 1
    };
  }

  if (trackLength === "1/8 mile" || trackLength === "1/5 mile") {
    return {
      width: 0.82,
      height: 0.92
    };
  }

  if (trackLength === "1/4 mile" || trackLength === "1/3 mile" || trackLength === "3/8 mile") {
    return {
      width: 0.92,
      height: 0.96
    };
  }

  if (trackLength === "1 mile") {
    return {
      width: 1.06,
      height: 0.98
    };
  }

  if (trackLength === "1.5 miles" || trackLength === "2 miles") {
    return {
      width: 1.14,
      height: 1
    };
  }

  return {
    width: 1,
    height: 0.98
  };
}

function clampPreviewPoint(point: PreviewPoint, width: number, height: number, padding: number) {
  return {
    x: roundNumber(Math.min(Math.max(point.x, padding), width - padding), 2),
    y: roundNumber(Math.min(Math.max(point.y, padding), height - padding), 2)
  };
}

function createEllipsePath({
  width = 320,
  height = 184,
  padding = 18,
  trackLength,
  pointCount = 96,
  rxMultiplier = 1,
  ryMultiplier = 1,
  pointModifier
}: {
  width?: number;
  height?: number;
  padding?: number;
  trackLength?: string | null;
  pointCount?: number;
  rxMultiplier?: number;
  ryMultiplier?: number;
  pointModifier?: (point: PreviewPoint, angle: number, index: number) => PreviewPoint;
}) {
  const scale = getTrackLengthScale(trackLength);
  const centerX = width / 2;
  const centerY = height / 2;
  const rx = ((width - padding * 2) / 2) * scale.width * rxMultiplier;
  const ry = ((height - padding * 2) / 2) * scale.height * ryMultiplier;

  return Array.from({ length: pointCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / pointCount;
    const point = {
      x: centerX + Math.cos(angle) * rx,
      y: centerY + Math.sin(angle) * ry
    };

    return clampPreviewPoint(
      pointModifier ? pointModifier(point, angle, index) : point,
      width,
      height,
      padding
    );
  });
}

function createCapsulePath({
  width = 320,
  height = 184,
  padding = 18,
  trackLength,
  pointCount = 96
}: {
  width?: number;
  height?: number;
  padding?: number;
  trackLength?: string | null;
  pointCount?: number;
}) {
  const scale = getTrackLengthScale(trackLength);
  const centerX = width / 2;
  const centerY = height / 2;
  const straightHalf = ((width - padding * 2) / 2) * Math.max(0.46, scale.width * 0.58);
  const radiusX = Math.max(22, (width - padding * 2) * 0.16);
  const radiusY = Math.max(24, ((height - padding * 2) / 2) * scale.height * 0.82);
  const leftCenterX = centerX - straightHalf + radiusX;
  const rightCenterX = centerX + straightHalf - radiusX;
  const topY = centerY - radiusY;
  const bottomY = centerY + radiusY;
  const quarter = Math.max(8, Math.floor(pointCount / 4));
  const topLineCount = quarter;
  const rightArcCount = quarter;
  const bottomLineCount = quarter;
  const leftArcCount = pointCount - topLineCount - rightArcCount - bottomLineCount;
  const points: PreviewPoint[] = [];

  for (let index = 0; index < topLineCount; index += 1) {
    const progress = index / topLineCount;
    points.push({ x: leftCenterX + progress * (rightCenterX - leftCenterX), y: topY });
  }

  for (let index = 0; index < rightArcCount; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * index) / rightArcCount;
    points.push({
      x: rightCenterX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY
    });
  }

  for (let index = 0; index < bottomLineCount; index += 1) {
    const progress = index / bottomLineCount;
    points.push({ x: rightCenterX - progress * (rightCenterX - leftCenterX), y: bottomY });
  }

  for (let index = 0; index < leftArcCount; index += 1) {
    const angle = Math.PI / 2 + (Math.PI * index) / leftArcCount;
    points.push({
      x: leftCenterX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY
    });
  }

  return points.map((point) => clampPreviewPoint(point, width, height, padding));
}

export function generatePaperclipOvalPath(input: GenerateOvalTemplateInput = {}) {
  return createCapsulePath({
    ...input,
    pointCount: 112
  });
}

export function generateSymmetricalOvalPath(input: GenerateOvalTemplateInput = {}) {
  return createEllipsePath(input);
}

export function generateDShapeOvalPath(input: GenerateOvalTemplateInput = {}) {
  const { padding = 18 } = input;
  const flatX = padding + 44;

  return createEllipsePath({
    ...input,
    pointModifier: (point, angle) => {
      if (Math.cos(angle) < -0.15) {
        return {
          x: flatX,
          y: point.y
        };
      }

      return point;
    }
  });
}

export function generateTriOvalPath(input: GenerateOvalTemplateInput = {}) {
  const { width = 320, height = 184 } = input;
  const centerX = width / 2;

  return createEllipsePath({
    ...input,
    pointModifier: (point, angle) => {
      const isFrontStretch = Math.sin(angle) > 0.52;
      const kinkStrength = Math.max(0, 1 - Math.abs(point.x - centerX) / (width * 0.28));

      return isFrontStretch
        ? {
            x: point.x,
            y: point.y - kinkStrength * height * 0.12
          }
        : point;
    }
  });
}

export function generateEggOvalPath(input: GenerateOvalTemplateInput = {}) {
  return createEllipsePath({
    ...input,
    pointModifier: (point, angle) => {
      const endScale = Math.cos(angle) < 0 ? 0.82 : 1.06;
      const centerX = (input.width ?? 320) / 2;

      return {
        x: centerX + (point.x - centerX) * endScale,
        y: point.y
      };
    }
  });
}

export function generateDoglegOvalPath(input: GenerateOvalTemplateInput = {}) {
  const { height = 184 } = input;

  return createEllipsePath({
    ...input,
    pointModifier: (point, angle) => {
      const isLowerRight = Math.sin(angle) > 0.22 && Math.cos(angle) > 0.08;

      return isLowerRight
        ? {
            x: point.x - height * 0.12,
            y: point.y + height * 0.035
          }
        : point;
    }
  });
}

export function generateFlatOvalPath(input: GenerateOvalTemplateInput = {}) {
  return createEllipsePath({
    ...input,
    ryMultiplier: 0.62,
    rxMultiplier: 1.06
  });
}

export function generateHighBankedOvalPath(input: GenerateOvalTemplateInput = {}) {
  return createEllipsePath({
    ...input,
    rxMultiplier: 1.04,
    ryMultiplier: 1.08
  });
}

export function generateShortTrackOvalPath(input: GenerateOvalTemplateInput = {}) {
  return createEllipsePath({
    ...input,
    rxMultiplier: 0.78,
    ryMultiplier: 0.92
  });
}

export function generateOvalTemplatePath(input: GenerateOvalTemplateInput = {}) {
  if (input.trackShape === "custom_unknown") {
    return [];
  }

  if (input.trackShape === "paperclip_oval") {
    return generatePaperclipOvalPath(input);
  }

  if (input.trackShape === "d_shaped_oval") {
    return generateDShapeOvalPath(input);
  }

  if (input.trackShape === "tri_oval") {
    return generateTriOvalPath(input);
  }

  if (input.trackShape === "egg_shaped_oval") {
    return generateEggOvalPath(input);
  }

  if (input.trackShape === "dogleg_oval") {
    return generateDoglegOvalPath(input);
  }

  if (input.trackShape === "flat_oval") {
    return generateFlatOvalPath(input);
  }

  if (input.trackShape === "high_banked_oval") {
    return generateHighBankedOvalPath(input);
  }

  if (input.trackShape === "short_track_oval") {
    return generateShortTrackOvalPath(input);
  }

  return generateSymmetricalOvalPath(input);
}

function calculatePreviewBounds(points: PreviewPoint[]): PreviewBounds | null {
  if (points.length === 0) {
    return null;
  }

  return points.reduce<PreviewBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: points[0].x,
      maxX: points[0].x,
      minY: points[0].y,
      maxY: points[0].y
    }
  );
}

function distanceBetweenPreviewPoints(pointA: PreviewPoint, pointB: PreviewPoint) {
  return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}

function resamplePreviewPath(points: PreviewPoint[], targetCount: number) {
  if (points.length === 0 || targetCount <= 0) {
    return [];
  }

  if (points.length === 1) {
    return Array.from({ length: targetCount }, () => points[0]);
  }

  const closedPoints = [...points, points[0]];
  const segmentLengths = closedPoints.slice(1).map((point, index) =>
    distanceBetweenPreviewPoints(closedPoints[index], point)
  );
  const totalLength = segmentLengths.reduce((total, length) => total + length, 0);

  if (totalLength === 0) {
    return Array.from({ length: targetCount }, () => points[0]);
  }

  return Array.from({ length: targetCount }, (_, index) => {
    const targetDistance = (totalLength * index) / targetCount;
    let traveled = 0;

    for (let segmentIndex = 0; segmentIndex < segmentLengths.length; segmentIndex += 1) {
      const segmentLength = segmentLengths[segmentIndex];

      if (traveled + segmentLength >= targetDistance) {
        const segmentProgress =
          segmentLength === 0 ? 0 : (targetDistance - traveled) / segmentLength;
        const start = closedPoints[segmentIndex];
        const end = closedPoints[segmentIndex + 1];

        return {
          x: roundNumber(start.x + (end.x - start.x) * segmentProgress, 2),
          y: roundNumber(start.y + (end.y - start.y) * segmentProgress, 2)
        };
      }

      traveled += segmentLength;
    }

    return points[points.length - 1];
  });
}

function averagePreviewPaths(pathA: PreviewPoint[], pathB: PreviewPoint[]) {
  const targetCount = Math.max(pathA.length, pathB.length, 1);
  const normalizedA = resamplePreviewPath(pathA, targetCount);
  const normalizedB = resamplePreviewPath(pathB, targetCount);

  return normalizedA.map((point, index) => ({
    x: roundNumber((point.x + normalizedB[index].x) / 2, 2),
    y: roundNumber((point.y + normalizedB[index].y) / 2, 2)
  }));
}

export function generateBaseLayerFromGpsTrace({
  outsidePathPreview,
  insidePathPreview,
  startFinishPreview
}: {
  outsidePathPreview: PreviewPoint[];
  insidePathPreview: PreviewPoint[];
  startFinishPreview: PreviewPoint[];
}) {
  const centerlinePreview =
    outsidePathPreview.length > 1 && insidePathPreview.length > 1
      ? averagePreviewPaths(outsidePathPreview, insidePathPreview)
      : outsidePathPreview.length > 1
        ? outsidePathPreview
        : insidePathPreview.length > 1
          ? insidePathPreview
          : [];

  return {
    outsidePathPreview,
    insidePathPreview,
    startFinishPreview,
    centerlinePreview
  };
}

export function mergeTemplateWithGpsTrace(
  templatePath: PreviewPoint[],
  gpsTracePath: PreviewPoint[],
  gpsWeight: number
) {
  if (templatePath.length === 0) {
    return gpsTracePath;
  }

  if (gpsTracePath.length === 0) {
    return templatePath;
  }

  const targetCount = Math.max(templatePath.length, gpsTracePath.length, 32);
  const template = resamplePreviewPath(templatePath, targetCount);
  const gps = resamplePreviewPath(gpsTracePath, targetCount);
  const weight = Math.min(Math.max(gpsWeight, 0), 1);

  return template.map((point, index) => ({
    x: roundNumber(point.x + (gps[index].x - point.x) * weight, 2),
    y: roundNumber(point.y + (gps[index].y - point.y) * weight, 2)
  }));
}

export function normalizeTrackCoordinates({
  outsidePath,
  startFinishLinePath,
  insidePath,
  currentPoint,
  width = 320,
  height = 180,
  padding = 18
}: NormalizeTrackCoordinatesInput): NormalizedPreviewPaths {
  const paths = [outsidePath, startFinishLinePath, insidePath];
  const points = [...paths.flat(), ...(currentPoint ? [currentPoint] : [])];
  const bbox = calculateBoundingBox(points);

  if (!bbox) {
    return {
      outside: [],
      startFinish: [],
      inside: [],
      current: null,
      previewBounds: null
    };
  }

  const lngSpan = Math.max(bbox.maxLng - bbox.minLng, 0.000001);
  const latSpan = Math.max(bbox.maxLat - bbox.minLat, 0.000001);
  const drawableWidth = Math.max(width - padding * 2, 1);
  const drawableHeight = Math.max(height - padding * 2, 1);

  const toPreviewPoint = (point: GpsPoint): PreviewPoint => ({
    x: roundNumber(padding + ((point.lng - bbox.minLng) / lngSpan) * drawableWidth, 2),
    y: roundNumber(height - padding - ((point.lat - bbox.minLat) / latSpan) * drawableHeight, 2)
  });

  const normalized = {
    outside: outsidePath.map(toPreviewPoint),
    startFinish: startFinishLinePath.map(toPreviewPoint),
    inside: insidePath.map(toPreviewPoint),
    current: currentPoint ? toPreviewPoint(currentPoint) : null
  };

  return {
    ...normalized,
    previewBounds: calculatePreviewBounds([
      ...normalized.outside,
      ...normalized.startFinish,
      ...normalized.inside,
      ...(normalized.current ? [normalized.current] : [])
    ])
  };
}

export function normalizePointsForPreview({
  outsidePath,
  startFinishPath,
  insidePath,
  currentPoint,
  width = 320,
  height = 180,
  padding = 18
}: {
  outsidePath: GpsPoint[];
  startFinishPath: GpsPoint[];
  insidePath: GpsPoint[];
  currentPoint?: GpsPoint | null;
  width?: number;
  height?: number;
  padding?: number;
}): NormalizedPreviewPaths {
  return normalizeTrackCoordinates({
    outsidePath,
    startFinishLinePath: startFinishPath,
    insidePath,
    currentPoint,
    width,
    height,
    padding
  });
}

export function buildTelemetryBaseLayer({
  outsidePath,
  startFinishLinePath,
  insidePath,
  currentPoint,
  trackType = null,
  trackShape = null,
  trackLength = null,
  createdAt = new Date().toISOString(),
  width = 320,
  height = 184,
  padding = 18
}: BuildTelemetryBaseLayerInput) {
  const normalized = normalizeTrackCoordinates({
    outsidePath,
    startFinishLinePath,
    insidePath,
    currentPoint,
    width,
    height,
    padding
  });
  const gpsLayer = generateBaseLayerFromGpsTrace({
    outsidePathPreview: normalized.outside,
    insidePathPreview: normalized.inside,
    startFinishPreview: normalized.startFinish
  });
  const templatePath =
    isOvalTrackType(trackType) && trackShape
      ? generateOvalTemplatePath({
          trackShape,
          trackLength,
          width,
          height,
          padding
        })
      : [];
  const totalGpsPoints = outsidePath.length + startFinishLinePath.length + insidePath.length;
  const gpsWeight = Math.min(totalGpsPoints / 80, 1);
  const centerlinePreview =
    templatePath.length > 0
      ? mergeTemplateWithGpsTrace(templatePath, gpsLayer.centerlinePreview, gpsWeight)
      : gpsLayer.centerlinePreview;
  const bounds =
    calculatePreviewBounds([
      ...centerlinePreview,
      ...gpsLayer.outsidePathPreview,
      ...gpsLayer.insidePathPreview,
      ...gpsLayer.startFinishPreview,
      ...templatePath
    ]) ?? normalized.previewBounds;

  return {
    baseLayer: {
      type: "generated_from_scan" as const,
      trackType,
      trackShape,
      trackLength,
      outsidePathPreview: gpsLayer.outsidePathPreview,
      insidePathPreview: gpsLayer.insidePathPreview,
      startFinishPreview: gpsLayer.startFinishPreview,
      centerlinePreview,
      templatePath,
      createdAt
    },
    previewBounds: bounds,
    normalized
  };
}

export function getTelemetryReplayPath(trackMap: Pick<SavedTrackMap, "base_layer">) {
  const baseLayer = trackMap.base_layer;

  if (!baseLayer) {
    return [];
  }

  if (baseLayer.centerlinePreview.length > 0) {
    return baseLayer.centerlinePreview;
  }

  if (baseLayer.outsidePathPreview.length > 0 && baseLayer.insidePathPreview.length > 0) {
    return averagePreviewPaths(baseLayer.outsidePathPreview, baseLayer.insidePathPreview);
  }

  return baseLayer.outsidePathPreview;
}

export function groupTracksByFacility(trackMaps: NearbyTrackMap[]): FacilityTrackGroup[] {
  const groupedTracks = trackMaps.reduce<Map<string, FacilityTrackGroup>>((groups, nearbyTrack) => {
    const track = nearbyTrack.track;
    const facilityKey =
      track.facility_key ?? generateFacilityKey(track.center_lat, track.center_lng);
    const existingGroup = groups.get(facilityKey);

    if (existingGroup) {
      existingGroup.tracks.push(nearbyTrack);
      return groups;
    }

    groups.set(facilityKey, {
      facilityKey,
      facilityName: track.facility_name,
      tracks: [nearbyTrack]
    });

    return groups;
  }, new Map<string, FacilityTrackGroup>());

  return Array.from(groupedTracks.values()).map((group) => ({
    ...group,
    tracks: group.tracks.sort((a, b) => a.distanceMeters - b.distanceMeters)
  }));
}

export function findNearbySavedTrack(
  currentPoint: CenterPoint,
  savedTracks: SavedTrackMap[],
  thresholdMeters = nearbyTrackThresholdMeters
) {
  return savedTracks
    .map((track) => ({
      track,
      distanceMeters: calculateDistanceMeters(currentPoint, {
        lat: track.center_lat,
        lng: track.center_lng
      })
    }))
    .filter(({ distanceMeters }) => distanceMeters <= thresholdMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0]?.track ?? null;
}

