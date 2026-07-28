import { StyleSheet } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import {
  FACE_MESH_CLOSED_CONTOURS,
  FACE_MESH_CONTOUR_ORDER,
} from '@/constants/faceMeshConnections';
import type { FaceMeshContours, FaceMeshPoint } from '@/types/faceMesh';

type FaceMeshWireframeProps = {
  width: number;
  height: number;
  /** Points already mapped into the SVG view coordinate space */
  contours?: FaceMeshContours | null;
  landmarks?: FaceMeshPoint[] | null;
  color?: string;
  strokeWidth?: number;
};

function pointsToPolyline(points: FaceMeshPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  const coords = points.map((point) => `${point.x},${point.y}`);
  if (closed && points.length > 2) {
    coords.push(`${points[0].x},${points[0].y}`);
  }
  return coords.join(' ');
}

export function FaceMeshWireframe({
  width,
  height,
  contours,
  landmarks,
  color = 'rgba(0, 255, 170, 0.85)',
  strokeWidth = 1.25,
}: FaceMeshWireframeProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const hasContours =
    !!contours && FACE_MESH_CONTOUR_ORDER.some((name) => (contours[name]?.length ?? 0) > 0);
  const hasLandmarks = !!landmarks && landmarks.length > 0;

  if (!hasContours && !hasLandmarks) {
    return null;
  }

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {hasContours &&
        FACE_MESH_CONTOUR_ORDER.map((name) => {
          const points = contours?.[name];
          if (!points || points.length < 2) return null;
          const closed = FACE_MESH_CLOSED_CONTOURS.has(name);
          return (
            <Polyline
              key={name}
              points={pointsToPolyline(points, closed)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
      {hasLandmarks &&
        landmarks!.map((point, index) => (
          <Circle
            key={`lm-${index}`}
            cx={point.x}
            cy={point.y}
            r={2}
            fill={color}
          />
        ))}
    </Svg>
  );
}
